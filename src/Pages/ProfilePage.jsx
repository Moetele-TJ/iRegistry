// src/Pages/ProfilePage.jsx
import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useToast } from "../contexts/ToastContext.jsx";
import RippleButton from "../components/RippleButton.jsx";
import PoliceStationSelect from "../components/PoliceStationSelect.jsx";
import { useNavigate, useSearchParams } from "react-router-dom";
import { invokeWithAuth } from "../lib/invokeWithAuth.js";
import { isPrivilegedRole } from "../lib/billingUx.js";
import { deriveUserStatus, isInactiveLockout } from "../lib/userState.js";
import { useModal } from "../contexts/ModalContext.jsx";
import {
  ArrowLeft,
  Mail,
  Shield,
  MapPin,
  BadgeCheck,
  Clock,
  Fingerprint,
  UserRound,
  Building2,
  Baby,
  Hash,
  Pencil,
  Phone,
  Smartphone,
  Copy,
  Wallet,
  AlertTriangle,
  History,
} from "lucide-react";
import UserActivityTimeline from "../components/UserActivityTimeline.jsx";
import { useUserActivity } from "../hooks/useUserActivity.js";

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return String(iso);
  }
}

function fmtDateOnly(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
  } catch {
    return String(iso);
  }
}

/** YYYY-MM-DD for `<input type="date" />` from DB / ISO value */
function profileDobForInput(iso) {
  if (!iso) return "";
  const s = String(iso);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  try {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function normalizeIdNumber(s) {
  return String(s ?? "").replace(/\s+/g, "").trim();
}

const MSG_NOTHING_TO_SUBMIT =
  "Nothing to submit — you have not changed any information.";

function profileFormMatchesServer(profileUser, form) {
  if (!profileUser) return false;
  const ns = (v) => String(v ?? "").trim();
  const ne = (v) => {
    const s = String(v ?? "").trim();
    return s === "" ? null : s;
  };
  if (ns(form.first_name) !== ns(profileUser.first_name)) return false;
  if (ns(form.last_name) !== ns(profileUser.last_name)) return false;
  if (ne(form.email) !== ne(profileUser.email ?? "")) return false;
  if (ns(form.phone) !== ns(profileUser.phone)) return false;
  if (ns(form.village) !== ns(profileUser.village)) return false;
  if (ns(form.ward) !== ns(profileUser.ward)) return false;
  if (ns(form.police_station) !== ns(profileUser.police_station)) return false;
  if (normalizeIdNumber(form.id_number) !== normalizeIdNumber(profileUser.id_number)) return false;
  const dobForm = String(form.date_of_birth ?? "").trim();
  const dobSaved = profileDobForInput(profileUser.date_of_birth);
  if (dobForm !== dobSaved) return false;
  return true;
}

function roleLabel(role) {
  const map = {
    user: "Registered user",
    admin: "Administrator",
    police: "Police",
    cashier: "Cashier",
  };
  return map[role] || role || "—";
}

function initials(user) {
  const f = String(user?.first_name || "").trim().charAt(0);
  const l = String(user?.last_name || "").trim().charAt(0);
  if (f && l) return (f + l).toUpperCase();
  if (f) return f.toUpperCase();
  const e = String(user?.email || "?").charAt(0);
  return e.toUpperCase();
}

function getDeviceId() {
  try {
    const k = "ireg_device_id";
    const existing = localStorage.getItem(k);
    if (existing && typeof existing === "string" && existing.length >= 8) return existing;
    return "";
  } catch {
    return "";
  }
}

function Card({ title, icon: Icon, actions, children, className = "" }) {
  return (
    <section
      className={`bg-white rounded-2xl border border-gray-100/80 shadow-md hover:shadow-xl transition-[box-shadow,transform] duration-300 overflow-hidden will-change-transform hover:-translate-y-[1px] ${className}`}
    >
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-gray-100 bg-gradient-to-r from-gray-50/80 to-white">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && (
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-iregistrygreen/10 text-iregistrygreen">
              <Icon size={18} strokeWidth={2} />
            </span>
          )}
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-800 truncate">{title}</h2>
        </div>
        {actions ? <div className="flex items-center gap-2 shrink-0">{actions}</div> : null}
      </div>
      <div className="p-5 sm:p-6 bg-gradient-to-b from-white to-gray-50/40">{children}</div>
    </section>
  );
}

function Field({ label, children, mono }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{label}</div>
      <div
        className={`text-sm text-gray-900 leading-snug break-words ${mono ? "font-mono text-xs text-gray-700 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100" : ""}`}
      >
        {children}
      </div>
    </div>
  );
}

const inputClass =
  "mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-iregistrygreen focus:outline-none focus:ring-2 focus:ring-iregistrygreen/20";

export default function ProfilePage() {
  const { user: sessionUser, refreshUser } = useAuth();
  const { addToast } = useToast();
  const { confirm } = useModal();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryUserId = searchParams.get("user");

  const [profileUser, setProfileUser] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    village: "",
    ward: "",
    police_station: "",
    id_number: "",
    date_of_birth: "",
  });

  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState("");

  const [trustedDevices, setTrustedDevices] = useState([]);
  const [trustedLoading, setTrustedLoading] = useState(false);
  const [trustedError, setTrustedError] = useState("");
  const [mobileSessionsMenuOpen, setMobileSessionsMenuOpen] = useState(false);
  const mobileSessionsMenuRef = useRef(null);
  /** lg+ desktop: tabbed sections (mobile keeps stacked cards). */
  const [desktopTab, setDesktopTab] = useState("profile");

  /** Admin/cashier opened `/profile?user=<uuid>` to inspect another account. */
  const viewingOther =
    !!(queryUserId && sessionUser?.id && String(queryUserId) !== String(sessionUser.id));

  const loadProfile = useCallback(async () => {
    if (!sessionUser?.id) return;
    setProfileLoading(true);
    setProfileError("");
    try {
      const body = queryUserId ? { user_id: queryUserId } : {};
      const { data, error } = await invokeWithAuth("get-user-profile", { body });
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || "Could not load profile");
      }
      setProfileUser(data.user ?? null);
    } catch (e) {
      setProfileUser(null);
      setProfileError(e?.message || "Could not load profile");
    } finally {
      setProfileLoading(false);
    }
  }, [sessionUser?.id, queryUserId]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const {
    activity: userRegistryActivity,
    loading: userRegistryActivityLoading,
    refresh: refreshUserRegistryActivity,
  } = useUserActivity(profileUser?.id);

  useEffect(() => {
    if (viewingOther && desktopTab === "security") setDesktopTab("profile");
  }, [viewingOther, desktopTab]);

  async function loadTrustedDevices() {
    setTrustedLoading(true);
    setTrustedError("");
    try {
      const { data, error } = await invokeWithAuth("user-trusted-devices", {
        body: { action: "list" },
      });
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || "Failed to load trusted devices");
      }
      setTrustedDevices(Array.isArray(data.devices) ? data.devices : []);
    } catch (e) {
      setTrustedDevices([]);
      setTrustedError(e?.message || "Failed to load trusted devices");
    } finally {
      setTrustedLoading(false);
    }
  }

  async function revokeTrustedDevice(deviceId) {
    if (!deviceId) return;
    const ok = await confirm({
      title: "Remove trusted browser?",
      message:
        "Next time you sign in from that browser, you will need to use email OTP before SMS (if your account has email).",
      confirmLabel: "Remove",
      cancelLabel: "Cancel",
      danger: true,
    }).catch(() => false);
    if (!ok) return;
    setTrustedLoading(true);
    setTrustedError("");
    try {
      const { data, error } = await invokeWithAuth("user-trusted-devices", {
        body: { action: "revoke", device_id: deviceId },
      });
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || "Could not remove device");
      }
      addToast({ type: "success", message: data.message || "Trusted browser removed." });
      await loadTrustedDevices();
    } catch (e) {
      setTrustedError(e?.message || "Could not remove device");
      addToast({ type: "error", message: e?.message || "Could not remove device" });
    } finally {
      setTrustedLoading(false);
    }
  }

  async function loadSessions() {
    setSessionsLoading(true);
    setSessionsError("");
    try {
      const { data, error } = await invokeWithAuth("self-sessions", { body: { action: "list" } });
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || "Failed to load sessions");
      }
      setSessions(Array.isArray(data.sessions) ? data.sessions : []);
    } catch (e) {
      setSessions([]);
      setSessionsError(e?.message || "Failed to load sessions");
    } finally {
      setSessionsLoading(false);
    }
  }

  useEffect(() => {
    if (!sessionUser?.id || viewingOther) return;
    void loadSessions();
    void loadTrustedDevices();
  }, [sessionUser?.id, viewingOther]);

  useEffect(() => {
    if (!mobileSessionsMenuOpen) return;
    function onDown(e) {
      const el = mobileSessionsMenuRef.current;
      if (!el) return;
      if (!el.contains(e.target)) setMobileSessionsMenuOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown, { passive: true });
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [mobileSessionsMenuOpen]);

  const openEdit = useCallback(() => {
    if (!profileUser || viewingOther) return;
    if (isInactiveLockout(profileUser)) {
      addToast({
        type: "error",
        message:
          "Your account is suspended or disabled. An administrator must reactivate it before you can edit your profile.",
      });
      return;
    }
    setDesktopTab("profile");
    setFormError("");
    setForm({
      first_name: profileUser.first_name ?? "",
      last_name: profileUser.last_name ?? "",
      email: profileUser.email ?? "",
      phone: profileUser.phone ?? "",
      village: profileUser.village ?? "",
      ward: profileUser.ward ?? "",
      police_station: profileUser.police_station ?? "",
      id_number: profileUser.id_number != null ? String(profileUser.id_number) : "",
      date_of_birth: profileDobForInput(profileUser.date_of_birth),
    });
    setEditing(true);
  }, [profileUser, viewingOther, addToast]);

  const cancelEdit = useCallback(() => {
    setFormError("");
    setEditing(false);
  }, []);

  async function saveProfile() {
    if (!profileUser?.id || viewingOther) return;
    if (isInactiveLockout(profileUser)) {
      addToast({
        type: "error",
        message:
          "Your account is suspended or disabled. An administrator must reactivate it before you can edit your profile.",
      });
      return;
    }
    const first_name = String(form.first_name ?? "").trim();
    const last_name = String(form.last_name ?? "").trim();
    const email = String(form.email ?? "").trim();
    const phone = String(form.phone ?? "").trim();
    const id_number = normalizeIdNumber(form.id_number);
    const dobRaw = String(form.date_of_birth ?? "").trim();
    if (!last_name) {
      const msg = "Last name is required.";
      setFormError(msg);
      addToast({ type: "error", message: msg });
      return;
    }
    if (!phone) {
      const msg = "Phone number is required.";
      setFormError(msg);
      addToast({ type: "error", message: msg });
      return;
    }
    if (!id_number) {
      const msg = "National ID / Passport is required.";
      setFormError(msg);
      addToast({ type: "error", message: msg });
      return;
    }
    if (dobRaw && !/^\d{4}-\d{2}-\d{2}$/.test(dobRaw)) {
      const msg = "Please enter date of birth as YYYY-MM-DD.";
      setFormError(msg);
      addToast({ type: "error", message: msg });
      return;
    }

    const origId = normalizeIdNumber(profileUser.id_number);
    const idChanged = id_number !== origId;

    if (profileFormMatchesServer(profileUser, form)) {
      addToast({ type: "info", message: MSG_NOTHING_TO_SUBMIT });
      return;
    }

    setFormError("");
    const ok = await confirm({
      title: idChanged ? "Change national ID?" : "Confirm",
      message: idChanged
        ? "Changing your National ID / Passport affects how you sign in. If the number does not match your official ID, you may be unable to log in until support helps you. Only continue if you are correcting a mistake.\n\nSave these changes to your profile?"
        : "Save these changes to your profile?",
      confirmLabel: "Save changes",
      cancelLabel: "Cancel",
      danger: idChanged,
    }).catch(() => false);
    if (!ok) return;

    setSaving(true);
    try {
      const { data, error } = await invokeWithAuth("update-user", {
        body: {
          id: String(profileUser.id),
          updates: {
            first_name: first_name || null,
            last_name,
            email: email || null,
            phone,
            village: String(form.village ?? "").trim() || null,
            ward: String(form.ward ?? "").trim() || null,
            police_station: String(form.police_station ?? "").trim() || null,
            id_number,
            date_of_birth: dobRaw ? dobRaw : null,
          },
        },
      });
      if (error || !data?.success) {
        const msg =
          (data && typeof data.message === "string" && data.message) ||
          error?.message ||
          "Could not save profile";
        throw new Error(msg);
      }
      await refreshUser();
      await loadProfile();
      await refreshUserRegistryActivity();
      setEditing(false);
      if (String(data?.message || "").toLowerCase().includes("no changes")) {
        addToast({ type: "info", message: MSG_NOTHING_TO_SUBMIT });
      } else {
        addToast({
          type: "success",
          message: "Your profile was updated successfully.",
        });
      }
    } catch (e) {
      const msg = e?.message || "Could not save profile";
      setFormError(msg);
      addToast({ type: "error", message: msg });
    } finally {
      setSaving(false);
    }
  }

  async function logoutOtherDevices() {
    const ok = await confirm({
      title: "Confirm",
      message: "Log out of other devices? You will stay logged in on this device.",
      confirmLabel: "Log out other devices",
      cancelLabel: "Cancel",
      variant: "warning",
    }).catch(() => false);
    if (!ok) return;

    try {
      const { data, error } = await invokeWithAuth("logout-other-sessions");
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || "Could not revoke sessions");
      }
      addToast({ type: "success", message: data?.message || "Logged out other devices." });
      // Refresh profile so last_login_at (derived from sessions) stays accurate.
      await refreshUser();
      await loadSessions();
    } catch (e) {
      addToast({ type: "error", message: e?.message || "Could not log out other devices" });
    }
  }

  async function revokeSession(sessionId) {
    const ok = await confirm({
      title: "Confirm",
      message: "Revoke this session? The device will be logged out.",
      confirmLabel: "Revoke session",
      cancelLabel: "Cancel",
      danger: true,
    }).catch(() => false);
    if (!ok) return;

    setSessionsLoading(true);
    setSessionsError("");
    try {
      const { data, error } = await invokeWithAuth("self-sessions", {
        body: { action: "revoke", session_id: sessionId },
      });
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || "Failed to revoke session");
      }
      addToast({ type: "success", message: data?.message || "Session revoked." });
      await refreshUser();
      await loadSessions();
    } catch (e) {
      const msg = e?.message || "Failed to revoke session";
      setSessionsError(msg);
      addToast({ type: "error", message: msg });
    } finally {
      setSessionsLoading(false);
    }
  }

  async function copyText(label, text) {
    if (text == null || String(text).trim() === "") return;
    try {
      await navigator.clipboard.writeText(String(text));
      addToast({ type: "success", message: `${label} copied to clipboard.` });
    } catch {
      addToast({ type: "error", message: "Could not copy." });
    }
  }

  if (!sessionUser) {
    return (
      <div className="min-h-[min(100vh,720px)] bg-gradient-to-b from-gray-100 to-gray-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-100 p-10 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-iregistrygreen/10 text-iregistrygreen">
            <UserRound size={32} />
          </div>
          <p className="text-gray-600">Sign in to view your profile.</p>
          <RippleButton
            className="mt-6 w-full max-w-xs mx-auto px-4 py-3 rounded-xl bg-iregistrygreen text-white font-medium shadow-md"
            onClick={() => navigate("/login")}
          >
            Login
          </RippleButton>
        </div>
      </div>
    );
  }

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
        <p className="text-sm text-gray-600">Loading profile…</p>
      </div>
    );
  }

  if (profileError || !profileUser) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
          <p className="text-red-700 text-sm">{profileError || "Could not load this profile."}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <RippleButton
              className="px-4 py-2 rounded-xl bg-iregistrygreen text-white text-sm font-medium"
              onClick={() => void loadProfile()}
            >
              Retry
            </RippleButton>
            <RippleButton
              className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-800"
              onClick={() => navigate(-1)}
            >
              Back
            </RippleButton>
          </div>
        </div>
      </div>
    );
  }

  const user = profileUser;
  const canSeeRegistryAccountId = isPrivilegedRole(sessionUser.role);

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  const displayName = fullName || user.email || "Your account";
  const derivedStatus = deriveUserStatus(user);
  const statusActive = derivedStatus === "active";

  function renderPersonalCard() {
    return (
      <Card title="Personal" icon={UserRound}>
        <div className="grid gap-6 sm:gap-7">
          {!editing ? (
            <>
              <Field label="Full name">{fullName || "—"}</Field>
              <Field label="Email">
                <span className="inline-flex items-center gap-2">
                  <Mail size={15} className="text-gray-400 shrink-0" />
                  {user.email || "—"}
                </span>
              </Field>
              <Field label="Phone">
                <span className="inline-flex items-center gap-2">
                  <Phone size={15} className="text-gray-400 shrink-0" />
                  {user.phone || "—"}
                </span>
              </Field>
              <Field label="National ID / Passport" mono>
                {user.id_number ? String(user.id_number) : "—"}
              </Field>
              <Field label="Date of birth">{fmtDateOnly(user.date_of_birth)}</Field>
              <div className="grid grid-cols-2 gap-4 pt-1">
                <Field label="Minor account">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${
                      user.is_minor ? "bg-amber-50 text-amber-800 border border-amber-100" : "bg-gray-50 text-gray-600 border border-gray-100"
                    }`}
                  >
                    <Baby size={14} />
                    {user.is_minor ? "Yes" : "No"}
                  </span>
                </Field>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">First name</label>
                <input
                  className={inputClass}
                  value={form.first_name}
                  onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
                  autoComplete="given-name"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Last name</label>
                <input
                  className={inputClass}
                  value={form.last_name}
                  onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
                  autoComplete="family-name"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Email</label>
                <input
                  type="email"
                  className={inputClass}
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Phone</label>
                <input
                  type="tel"
                  className={inputClass}
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  autoComplete="tel"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  National ID / Passport
                </label>
                <input
                  className={inputClass}
                  value={form.id_number}
                  onChange={(e) => setForm((f) => ({ ...f, id_number: e.target.value }))}
                  autoComplete="off"
                  inputMode="text"
                  spellCheck={false}
                />
                <div
                  className="mt-2 flex gap-2 rounded-xl border border-amber-200/90 bg-amber-50/90 px-3 py-2.5 text-xs text-amber-950 leading-snug"
                  role="note"
                >
                  <AlertTriangle className="shrink-0 w-4 h-4 text-amber-600 mt-0.5" aria-hidden />
                  <span>
                    Be careful: this number is used to sign in with your last name. Changing it to something that does not
                    match your official ID can lock you out of your account until support can help.
                  </span>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Date of birth</label>
                <input
                  type="date"
                  className={inputClass}
                  value={form.date_of_birth}
                  onChange={(e) => setForm((f) => ({ ...f, date_of_birth: e.target.value }))}
                  autoComplete="bday"
                />
              </div>
              <div className="grid grid-cols-2 gap-4 pt-1">
                <Field label="Minor account">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${
                      user.is_minor ? "bg-amber-50 text-amber-800 border border-amber-100" : "bg-gray-50 text-gray-600 border border-gray-100"
                    }`}
                  >
                    <Baby size={14} />
                    {user.is_minor ? "Yes" : "No"}
                  </span>
                </Field>
              </div>
              <p className="text-xs text-gray-500 pt-1">
                Minor status updates when your date of birth changes. Identity verification is managed by administrators.
              </p>
            </>
          )}
        </div>
      </Card>
    );
  }

  function renderLocationCard() {
    const isPolice = String(user?.role || "").toLowerCase() === "police";
    return (
      <Card title="Location" icon={MapPin}>
        <div className="grid gap-6">
          {!editing ? (
            <>
              <Field label="Town / Village">
                <span className="inline-flex items-start gap-2">
                  <Building2 size={15} className="text-gray-400 mt-0.5 shrink-0" />
                  {user.village || "—"}
                </span>
              </Field>
              <Field label="Ward / Street">{user.ward || "—"}</Field>
              <Field label="Police station">{user.police_station || "—"}</Field>
            </>
          ) : (
            <>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Town / Village</label>
                <input
                  className={inputClass}
                  value={form.village}
                  onChange={(e) => setForm((f) => ({ ...f, village: e.target.value }))}
                  autoComplete="address-level2"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Ward / Street</label>
                <input
                  className={inputClass}
                  value={form.ward}
                  onChange={(e) => setForm((f) => ({ ...f, ward: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Police station</label>
                <PoliceStationSelect
                  label={null}
                  value={form.police_station}
                  onChange={(v) => setForm((f) => ({ ...f, police_station: v }))}
                  required={false}
                  withAuth={true}
                  inputClassName={inputClass}
                  placeholder={isPolice ? "Select a police station…" : "Police station"}
                  helpText={
                    isPolice
                      ? "This is used to match your station queue and case activity."
                      : undefined
                  }
                />
              </div>
            </>
          )}
        </div>
      </Card>
    );
  }

  function renderAccountCard() {
    const emailVerified = !!user.email_verified;
    return (
      <Card title="Account & verification" icon={Shield}>
        <div className="grid gap-6 sm:grid-cols-2 sm:gap-8">
          <div className="space-y-6">
            <Field label="Role">{roleLabel(user.role)}</Field>
            <Field label="Account status">
              <span
                className={`inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium ${
                  statusActive ? "bg-emerald-50 text-emerald-800 border border-emerald-100" : "bg-gray-100 text-gray-700"
                }`}
              >
                {derivedStatus || "—"}
              </span>
            </Field>
            <Field label="Credits balance">
              <span className="inline-flex items-center gap-2">
                <Wallet size={15} className="text-gray-400 shrink-0" />
                <span className="tabular-nums font-semibold text-gray-900">{Number(user.credit_balance ?? 0)}</span>
                <span className="text-gray-500">credits</span>
              </span>
            </Field>
          </div>
          <div className="space-y-6">
            <Field label="Identity verified">
              <span
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium border ${
                  user.identity_verified ? "bg-emerald-50 text-emerald-800 border-emerald-100" : "bg-gray-50 text-gray-600 border-gray-100"
                }`}
              >
                <BadgeCheck size={18} className={user.identity_verified ? "text-emerald-600" : "text-gray-400"} />
                {user.identity_verified ? "Verified" : "Not verified"}
              </span>
            </Field>
            <Field label="Email verified">
              <span
                className={`inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  emailVerified ? "bg-emerald-50 text-emerald-800 border border-emerald-100" : "bg-gray-50 text-gray-600 border border-gray-100"
                }`}
              >
                {emailVerified ? "Yes" : "No"}
              </span>
            </Field>
          </div>
        </div>
        {user.suspended_reason || user.disabled_reason || user.deleted_at ? (
          <div className="mt-6 pt-4 border-t border-gray-100 space-y-3">
            {user.suspended_reason ? (
              <>
                <Field label="Suspension reason">{String(user.suspended_reason)}</Field>
                {user.suspended_at ? <Field label="Suspended since">{fmtDate(user.suspended_at)}</Field> : null}
              </>
            ) : null}
            {user.disabled_reason ? (
              <>
                <Field label="Disabled reason">{String(user.disabled_reason)}</Field>
                {user.disabled_at ? <Field label="Disabled since">{fmtDate(user.disabled_at)}</Field> : null}
              </>
            ) : null}
            {user.deleted_at ? <Field label="Deleted at">{fmtDate(user.deleted_at)}</Field> : null}
          </div>
        ) : null}
      </Card>
    );
  }

  function renderRegistryHistoryCard() {
    return (
      <Card title="Registry history" icon={History}>
        <UserActivityTimeline
          events={userRegistryActivity}
          loading={userRegistryActivityLoading}
        />
      </Card>
    );
  }

  function renderActivityCard() {
    return (
      <Card title="Activity & identifiers" icon={Fingerprint}>
        <div className="grid gap-6 sm:grid-cols-2 sm:gap-8">
          {canSeeRegistryAccountId ? (
            <div className="sm:col-span-2 space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Registry account ID (system)</div>
              <div className="font-mono text-xs text-gray-700 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100 flex items-start gap-2 leading-snug break-words">
                <Hash size={14} className="text-gray-400 mt-0.5 shrink-0" />
                <span className="min-w-0 flex-1 break-all">{user.id ? String(user.id) : "—"}</span>
                {user.id ? (
                  <RippleButton
                    type="button"
                    className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md border border-gray-200 bg-white text-xs text-gray-700"
                    onClick={() => void copyText("Registry account ID", user.id)}
                    title="Copy registry account ID"
                  >
                    <Copy size={14} />
                  </RippleButton>
                ) : null}
              </div>
            </div>
          ) : null}
          <Field label="Last login">
            <span className="inline-flex items-center gap-2 text-gray-800">
              <Clock size={16} className="text-gray-400 shrink-0" />
              {fmtDate(user.last_login_at)}
            </span>
          </Field>
          <Field label="Account opened">{fmtDate(user.created_at)}</Field>
        </div>
      </Card>
    );
  }

  function renderSessionsCard() {
    return (
      <Card
        title="Active sessions"
        icon={Clock}
        actions={
          <>
            <div className="sm:hidden relative" ref={mobileSessionsMenuRef}>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900 text-sm font-semibold px-3 py-2 shadow-sm hover:bg-emerald-100 active:scale-[0.99] transition disabled:opacity-60"
                onClick={() => setMobileSessionsMenuOpen((v) => !v)}
                disabled={sessionsLoading}
                aria-haspopup="menu"
                aria-expanded={mobileSessionsMenuOpen}
              >
                Manage sessions
                <span aria-hidden className="text-emerald-700">
                  ▾
                </span>
              </button>

              {mobileSessionsMenuOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-56 rounded-2xl border border-gray-100 bg-white shadow-xl overflow-hidden z-[90]"
                >
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full text-left px-4 py-3 text-sm font-semibold text-emerald-900 hover:bg-emerald-50"
                    onClick={() => {
                      setMobileSessionsMenuOpen(false);
                      void logoutOtherDevices();
                    }}
                  >
                    Log out other devices
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full text-left px-4 py-3 text-sm font-semibold text-emerald-900 hover:bg-emerald-50"
                    onClick={() => {
                      setMobileSessionsMenuOpen(false);
                      void loadSessions();
                    }}
                  >
                    Refresh
                  </button>
                </div>
              ) : null}
            </div>

            <div className="hidden sm:flex items-center gap-2">
              <RippleButton
                type="button"
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold shadow-md hover:shadow-lg hover:bg-emerald-700 active:scale-[0.99] transition"
                onClick={() => void logoutOtherDevices()}
              >
                Log out other devices
              </RippleButton>
              <RippleButton
                type="button"
                className="px-4 py-2 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-sm font-semibold shadow-sm hover:shadow-md hover:bg-emerald-100 active:scale-[0.99] transition disabled:opacity-60"
                onClick={() => void loadSessions()}
                disabled={sessionsLoading}
              >
                {sessionsLoading ? "Refreshing…" : "Refresh"}
              </RippleButton>
            </div>
          </>
        }
      >
        <div className="text-sm text-gray-500 mb-4">Manage where you’re currently signed in.</div>
        {sessionsError ? (
          <div className="mb-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">{sessionsError}</div>
        ) : null}

        {sessionsLoading && sessions.length === 0 ? (
          <div className="text-sm text-gray-500">Loading sessions…</div>
        ) : sessions.length === 0 ? (
          <div className="text-sm text-gray-500">No active sessions found.</div>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => {
              const thisDevice = s?.device_id && getDeviceId() && String(s.device_id) === String(getDeviceId());
              const id = s?.id ? String(s.id) : "";
              const ip = String(s?.ip_address || "").split(",")[0].trim();
              const ua = String(s?.user_agent || "");
              return (
                <div key={id || Math.random()} className="rounded-2xl border border-gray-100 bg-white/80 shadow-sm px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                        <span className="truncate">{thisDevice ? "This device" : s?.device_name ? String(s.device_name) : "Session"}</span>
                        {thisDevice ? (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-100">
                            current
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Started: {fmtDate(s?.created_at)} • Expires: {fmtDate(s?.expires_at)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 break-words">
                        {ip ? `IP: ${ip}` : "IP: —"}
                        {ua ? ` • UA: ${ua.slice(0, 120)}` : ""}
                      </div>
                    </div>
                    <div className="shrink-0">
                      <RippleButton
                        type="button"
                        className="px-3 py-2 rounded-xl bg-red-50 text-red-700 border border-red-100 text-sm font-semibold hover:bg-red-100 disabled:opacity-60"
                        disabled={sessionsLoading || thisDevice}
                        title={thisDevice ? "You cannot revoke your current session from this device." : "Revoke session"}
                        onClick={() => void revokeSession(id)}
                      >
                        Revoke
                      </RippleButton>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    );
  }

  function renderTrustedCard() {
    return (
      <Card title="Trusted browsers (SMS login)" icon={Smartphone}>
        <div className="text-sm text-gray-500 mb-4">
          Browsers that completed email sign-in can use SMS codes (SMS uses credits). Remove a browser to require email verification there again.
        </div>
        {trustedError ? (
          <div className="mb-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">{trustedError}</div>
        ) : null}
        {trustedLoading && trustedDevices.length === 0 ? (
          <div className="text-sm text-gray-500">Loading…</div>
        ) : trustedDevices.length === 0 ? (
          <div className="text-sm text-gray-500">No trusted browsers yet. After you sign in with email on a device, it appears here.</div>
        ) : (
          <div className="space-y-3">
            {trustedDevices.map((d) => {
              const did = String(d?.device_id || "");
              const short = did.length > 16 ? `${did.slice(0, 8)}…${did.slice(-4)}` : did || "—";
              const dn = String(d?.device_name || "").trim();
              const isHere = did && getDeviceId() && String(did) === String(getDeviceId());
              return (
                <div
                  key={did}
                  className="rounded-2xl border border-gray-100 bg-white/80 shadow-sm px-4 py-3 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 flex items-center gap-2 flex-wrap">
                      <span className="truncate">{dn || "Trusted browser"}</span>
                      {isHere ? (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-100">
                          this device
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {dn ? (
                        <span className="font-mono text-[11px] text-gray-400">ID: {short}</span>
                      ) : (
                        <span className="font-mono text-[11px] text-gray-400">{short}</span>
                      )}
                      <span className="text-gray-300"> · </span>
                      Trusted since {fmtDate(d?.verified_at)}
                    </div>
                  </div>
                  <RippleButton
                    type="button"
                    className="shrink-0 px-3 py-2 rounded-xl bg-red-50 text-red-700 border border-red-100 text-sm font-semibold hover:bg-red-100 disabled:opacity-60"
                    disabled={trustedLoading}
                    onClick={() => void revokeTrustedDevice(did)}
                  >
                    Remove
                  </RippleButton>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    );
  }

  function renderAdminFootnote() {
    if (viewingOther) {
      return (
        <p className="text-xs text-gray-500 leading-relaxed px-1 lg:px-2">
          Staff read-only view. Use the Users page to change role, account status, identity verification, or national ID
          records.
        </p>
      );
    }
    return (
      <p className="text-xs text-gray-500 leading-relaxed px-1 lg:px-2">
        Role and verification status are managed by administrators. Use Edit profile to change your name, contact details,
        location, date of birth, and national ID—only change your national ID to fix a mistake, or you may not be able to sign
        in.
      </p>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto w-full py-6 sm:py-8 lg:py-10 pb-12">
        <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="border-b border-emerald-100/80 bg-gradient-to-r from-emerald-50/95 via-emerald-50/80 to-emerald-50/60 px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-iregistrygreen tracking-tight">Profile</h1>
                <p className="mt-1 text-sm text-gray-500">
                  {viewingOther
                    ? "Staff view — another user’s account details (read-only)"
                    : "Your account details and registry identity"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                {!viewingOther && !editing && !isInactiveLockout(user) ? (
                  <RippleButton
                    type="button"
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-iregistrygreen text-white text-sm font-medium shadow-sm hover:opacity-95 transition-opacity"
                    onClick={openEdit}
                  >
                    <Pencil size={18} />
                    Edit profile
                  </RippleButton>
                ) : !viewingOther && editing ? (
                  <>
                    <RippleButton
                      type="button"
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                      onClick={cancelEdit}
                      disabled={saving}
                    >
                      Cancel
                    </RippleButton>
                    <RippleButton
                      type="button"
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-iregistrygreen text-white text-sm font-medium shadow-sm disabled:opacity-60"
                      onClick={() => void saveProfile()}
                      disabled={saving}
                    >
                      {saving ? "Saving…" : "Save changes"}
                    </RippleButton>
                  </>
                ) : null}
                <RippleButton
                  type="button"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-200/80 bg-white/90 text-sm font-medium text-gray-700 shadow-sm hover:bg-white transition-colors"
                  onClick={() => navigate(-1)}
                >
                  <ArrowLeft size={18} className="opacity-70" />
                  Back
                </RippleButton>
              </div>
            </div>
          </div>

          <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            {formError ? (
              <div
                role="alert"
                aria-live="assertive"
                className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800"
              >
                {formError}
              </div>
            ) : null}

            {viewingOther ? (
              <div className="mb-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                You are viewing <strong>{displayName}</strong>’s profile. Sessions and trusted browsers are not shown here—those
                belong to the account holder. Editing is disabled; use Users admin tools for role, status, and verification
                changes.
              </div>
            ) : null}

            {!viewingOther && isInactiveLockout(user) ? (
              <div className="mb-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                Your account is suspended or disabled. Profile editing is disabled until an administrator reactivates your
                account.
              </div>
            ) : null}

            {/* Compact profile summary: name on top; details in a horizontal band below */}
            <div className="mb-6 rounded-2xl border border-gray-100 bg-gray-50/60 p-4 sm:p-5 shadow-sm">
              <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                <div
                  className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl bg-iregistrygreen/10 text-iregistrygreen text-base sm:text-lg font-bold ring-2 ring-iregistrygreen/15"
                  aria-hidden
                >
                  {initials(user)}
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight truncate min-w-0">{displayName}</h2>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100/90 flex flex-wrap gap-x-6 gap-y-4 sm:gap-x-8 lg:gap-x-10">
                <div className="min-w-[8rem] sm:min-w-[9rem]">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Role</p>
                  <p className="text-sm text-gray-900 font-medium mt-1">{roleLabel(user.role)}</p>
                </div>
                <div className="min-w-[8rem] sm:min-w-[9rem]">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Status</p>
                  <div className="mt-1">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        statusActive ? "bg-emerald-50 text-emerald-800 border border-emerald-100" : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {derivedStatus || "—"}
                    </span>
                  </div>
                </div>
                {user.email ? (
                  <div className="min-w-[12rem] flex-1 sm:flex-none sm:max-w-md">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Email</p>
                    <p className="text-sm text-gray-800 mt-1 flex items-start gap-1.5 min-w-0">
                      <Mail size={15} className="shrink-0 text-gray-400 mt-0.5" />
                      <span className="break-all min-w-0">{user.email}</span>
                    </p>
                  </div>
                ) : null}
                {canSeeRegistryAccountId ? (
                  <div className="min-w-[10rem] flex-1 sm:flex-none sm:max-w-xs lg:max-w-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Registry account ID</p>
                    <div className="mt-1 flex items-start gap-2 min-w-0">
                      <p className="font-mono text-xs text-gray-800 break-all min-w-0 leading-snug">{user.id || "—"}</p>
                      {user.id ? (
                        <RippleButton
                          type="button"
                          className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-200 bg-white text-xs text-gray-700"
                          onClick={() => void copyText("Registry account ID", user.id)}
                          title="Copy registry account ID"
                        >
                          <Copy size={14} />
                          <span className="hidden sm:inline">Copy</span>
                        </RippleButton>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                <div className="min-w-[10rem] flex-1 sm:flex-none sm:max-w-xs">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">National ID / Passport</p>
                  <div className="mt-1 flex items-start gap-2 min-w-0">
                    <p className="text-sm text-gray-900 font-medium tabular-nums min-w-0 break-words">
                      {user.id_number ? String(user.id_number) : "—"}
                    </p>
                    {user.id_number ? (
                      <RippleButton
                        type="button"
                        className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-200 bg-white text-xs text-gray-700"
                        onClick={() => void copyText("National ID / Passport", user.id_number)}
                        title="Copy ID number"
                      >
                        <Copy size={14} />
                        <span className="hidden sm:inline">Copy</span>
                      </RippleButton>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile and tablet (below lg): stacked cards — same sections as before */}
            <div className="lg:hidden space-y-5">
              {renderPersonalCard()}
              {renderLocationCard()}
              {renderAccountCard()}
              {renderActivityCard()}
              {renderRegistryHistoryCard()}
              {!viewingOther ? (
                <>
                  {renderSessionsCard()}
                  {renderTrustedCard()}
                </>
              ) : null}
              {renderAdminFootnote()}
            </div>

            {/* Desktop lg+: tabbed sections */}
            <div className="hidden lg:block space-y-6">
              <div role="tablist" aria-label="Profile sections" className="flex flex-wrap gap-1 border-b border-gray-200">
                {(viewingOther
                  ? [
                      { id: "profile", label: "Personal & location" },
                      { id: "account", label: "Account" },
                    ]
                  : [
                      { id: "profile", label: "Personal & location" },
                      { id: "account", label: "Account" },
                      { id: "security", label: "Sessions & devices" },
                    ]
                ).map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={desktopTab === id}
                    className={`px-4 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                      desktopTab === id
                        ? "border-iregistrygreen text-iregistrygreen"
                        : "border-transparent text-gray-500 hover:text-gray-800"
                    }`}
                    onClick={() => setDesktopTab(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {desktopTab === "profile" && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                  {renderPersonalCard()}
                  {renderLocationCard()}
                </div>
              )}
              {desktopTab === "account" && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                    {renderAccountCard()}
                    {renderActivityCard()}
                  </div>
                  {renderRegistryHistoryCard()}
                </div>
              )}
              {!viewingOther && desktopTab === "security" ? (
                <div className="space-y-6">
                  {renderSessionsCard()}
                  {renderTrustedCard()}
                </div>
              ) : null}

              <div className="mt-8 pt-2 border-t border-gray-100/80">{renderAdminFootnote()}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
