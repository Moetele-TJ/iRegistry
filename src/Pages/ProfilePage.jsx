// src/Pages/ProfilePage.jsx
import { useEffect, useRef, useState, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useToast } from "../contexts/ToastContext.jsx";
import RippleButton from "../components/RippleButton.jsx";
import { useNavigate } from "react-router-dom";
import { useAdminSidebar } from "../hooks/useAdminSidebar.jsx";
import { invokeWithAuth } from "../lib/invokeWithAuth.js";
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
} from "lucide-react";

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
  const { user, refreshUser } = useAuth();
  const { addToast } = useToast();
  const { confirm } = useModal();
  const navigate = useNavigate();
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
  });

  useAdminSidebar({ visible: !!user && user.role === "admin" });

  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState("");
  const [mobileSessionsMenuOpen, setMobileSessionsMenuOpen] = useState(false);
  const mobileSessionsMenuRef = useRef(null);

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
    if (!user?.id) return;
    void loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

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
    if (!user) return;
    setFormError("");
    setForm({
      first_name: user.first_name ?? "",
      last_name: user.last_name ?? "",
      email: user.email ?? "",
      phone: user.phone ?? "",
      village: user.village ?? "",
      ward: user.ward ?? "",
      police_station: user.police_station ?? "",
    });
    setEditing(true);
  }, [user]);

  const cancelEdit = useCallback(() => {
    setFormError("");
    setEditing(false);
  }, []);

  async function saveProfile() {
    if (!user?.id) return;
    const first_name = String(form.first_name ?? "").trim();
    const last_name = String(form.last_name ?? "").trim();
    const email = String(form.email ?? "").trim();
    const phone = String(form.phone ?? "").trim();
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
    setSaving(true);
    setFormError("");
    try {
      const ok = await confirm({
        title: "Confirm",
        message: "Save these changes to your profile?",
        confirmLabel: "Save changes",
        cancelLabel: "Cancel",
      }).catch(() => false);
      if (!ok) return;

      const { data, error } = await invokeWithAuth("update-user", {
        body: {
          id: String(user.id),
          updates: {
            first_name: first_name || null,
            last_name,
            email: email || null,
            phone,
            village: String(form.village ?? "").trim() || null,
            ward: String(form.ward ?? "").trim() || null,
            police_station: String(form.police_station ?? "").trim() || null,
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
      setEditing(false);
      if (String(data?.message || "").toLowerCase().includes("no changes")) {
        addToast({ type: "info", message: "No changes to save." });
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

  if (!user) {
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

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  const displayName = fullName || user.email || "Your account";
  const statusActive = String(user.status || "").toLowerCase() === "active";

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-100 via-gray-50/90 to-gray-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10 pb-12">
        {/* Top actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 lg:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Profile</h1>
            <p className="mt-1 text-sm text-gray-500">Your account details and registry identity</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            {!editing ? (
              <RippleButton
                type="button"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-iregistrygreen text-white text-sm font-medium shadow-sm hover:opacity-95 transition-opacity"
                onClick={openEdit}
              >
                <Pencil size={18} />
                Edit profile
              </RippleButton>
            ) : (
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
            )}
            <RippleButton
              type="button"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft size={18} className="opacity-70" />
              Back
            </RippleButton>
          </div>
        </div>

        {formError ? (
          <div
            role="alert"
            aria-live="assertive"
            className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {formError}
          </div>
        ) : null}

        {/* Hero */}
        <div className="relative mb-6 lg:mb-8 rounded-3xl overflow-hidden border border-emerald-100/80 shadow-lg bg-gradient-to-br from-iregistrygreen via-emerald-600 to-emerald-800 text-white">
          <div className="absolute inset-0 opacity-[0.12] bg-[radial-gradient(circle_at_30%_20%,white,transparent_55%)]" />
          <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="relative px-6 sm:px-8 lg:px-10 py-8 sm:py-10 lg:py-12 flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-10">
            <div
              className="flex h-24 w-24 sm:h-28 sm:w-28 shrink-0 items-center justify-center rounded-3xl bg-white/20 backdrop-blur-sm text-3xl sm:text-4xl font-bold ring-4 ring-white/25 shadow-inner"
              aria-hidden
            >
              {initials(user)}
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wide backdrop-blur-sm">
                  {roleLabel(user.role)}
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                    statusActive ? "bg-emerald-400/30 text-white ring-1 ring-white/40" : "bg-black/20 text-white/90"
                  }`}
                >
                  {user.status ? String(user.status) : "—"}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight break-words">{displayName}</h2>
              {user.email && (
                <p className="flex items-center gap-2 text-sm sm:text-base text-white/90">
                  <Mail size={18} className="shrink-0 opacity-80" />
                  <span className="truncate">{user.email}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Content grid — max width use on large screens */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6">
          <div className="lg:col-span-5 space-y-5 lg:space-y-6">
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
                )}
              </div>
            </Card>

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
                      <input
                        className={inputClass}
                        value={form.police_station}
                        onChange={(e) => setForm((f) => ({ ...f, police_station: e.target.value }))}
                      />
                    </div>
                  </>
                )}
              </div>
            </Card>
          </div>

          <div className="lg:col-span-7 space-y-5 lg:space-y-6">
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
                      {user.status ? String(user.status) : "—"}
                    </span>
                  </Field>
                </div>
                <div className="space-y-6">
                  <Field label="Identity verified">
                    <span
                      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium border ${
                        user.identity_verified
                          ? "bg-emerald-50 text-emerald-800 border-emerald-100"
                          : "bg-gray-50 text-gray-600 border-gray-100"
                      }`}
                    >
                      <BadgeCheck
                        size={18}
                        className={user.identity_verified ? "text-emerald-600" : "text-gray-400"}
                      />
                      {user.identity_verified ? "Verified" : "Not verified"}
                    </span>
                  </Field>
                </div>
              </div>
            </Card>

            <Card title="Activity & identifier" icon={Fingerprint}>
              <div className="grid gap-6 sm:grid-cols-2 sm:gap-8">
                <Field label="Last login">
                  <span className="inline-flex items-center gap-2 text-gray-800">
                    <Clock size={16} className="text-gray-400 shrink-0" />
                    {fmtDate(user.last_login_at)}
                  </span>
                </Field>
                <Field label="User ID" mono>
                  <span className="inline-flex items-start gap-2">
                    <Hash size={14} className="text-gray-400 mt-0.5 shrink-0" />
                    {user.id ? String(user.id) : "—"}
                  </span>
                </Field>
              </div>
            </Card>

            <Card
              title="Active sessions"
              icon={Clock}
              actions={
                <>
                  {/* Mobile: compact actions menu (label is NOT an option) */}
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
                      <span aria-hidden className="text-emerald-700">▾</span>
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

                  {/* Desktop: buttons */}
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
              <div className="text-sm text-gray-500 mb-4">
                Manage where you’re currently signed in.
              </div>
              {sessionsError ? (
                <div className="mb-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
                  {sessionsError}
                </div>
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
                      <div
                        key={id || Math.random()}
                        className="rounded-2xl border border-gray-100 bg-white/80 shadow-sm px-4 py-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                              <span className="truncate">
                                {thisDevice ? "This device" : (s?.device_name ? String(s.device_name) : "Session")}
                              </span>
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

            <p className="text-xs text-gray-500 leading-relaxed px-1 lg:px-2">
              Role, verification status, and national ID are managed by administrators. Use Edit profile to change your name, contact details, and location.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
