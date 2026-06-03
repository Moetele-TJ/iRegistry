import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pencil, UserPlus } from "lucide-react";
import RippleButton from "../../components/RippleButton.jsx";
import CountryPhoneInput from "../../components/CountryPhoneInput.jsx";
import PoliceStationSelect from "../../components/PoliceStationSelect.jsx";
import TownWardStationSelect from "../../components/TownWardStationSelect.jsx";
import YearMonthDaySelect from "../../components/YearMonthDaySelect.jsx";
import { invokeFn } from "../../lib/invokeFn.js";
import PageSectionCard from "./PageSectionCard.jsx";
import { invokeWithAuth } from "../../lib/invokeWithAuth.js";
import { useToast } from "../../contexts/ToastContext.jsx";
import { useModal } from "../../contexts/ModalContext.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { deriveUserStatus, isInactiveLockout } from "../../lib/userState.js";
import { displayUser } from "../../lib/userDisplay.js";
import {
  NAV_ACTIONS,
  USER_ACCOUNT_STATUS_FORM_OPTIONS,
} from "../../lib/navLabels.js";
import {
  EMPTY_STAFF_USER_FORM,
  MSG_NOTHING_TO_SUBMIT,
  dobFromRow,
  dobInputStr,
  normEmail,
  normIdNumber,
  normStr,
  staffUserEditHasChanges,
  staffUserFormFromRow,
  staffUsersReturnUrl,
} from "../../lib/staffUserForm.js";
import { validateStaffUserForm } from "../../lib/staffUserFormValidation.js";
import { staffUsersListPath } from "../../lib/staffUsersListView.js";

const locationInputClass = "w-full border rounded-lg px-3 py-2";

export default function StaffUserFormPage({ variant = "admin", mode = "edit" }) {
  const isAdd = mode === "add";
  const { userId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user: sessionUser } = useAuth();
  const { addToast } = useToast();
  const { confirm } = useModal();

  const canAdminister = String(variant || "admin").toLowerCase() === "admin";
  const canCreateUser = canAdminister || String(variant || "").toLowerCase() === "cashier";
  const staffRole = canAdminister ? "admin" : "cashier";
  const usersListPath = staffUsersListPath(staffRole);
  const sessionUserId = sessionUser?.id != null ? String(sessionUser.id) : "";

  const [targetUser, setTargetUser] = useState(null);
  const [profileLoading, setProfileLoading] = useState(!isAdd);
  const [profileError, setProfileError] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(EMPTY_STAFF_USER_FORM);

  const returnTo = location.state?.returnTo;

  const goBack = useCallback(
    (highlightUserId) => {
      navigate(staffUsersReturnUrl(staffRole, returnTo, highlightUserId));
    },
    [navigate, staffRole, returnTo],
  );

  const loadTarget = useCallback(async () => {
    if (isAdd || !userId) return;
    setProfileLoading(true);
    setProfileError("");
    try {
      const { data, error } = await invokeWithAuth("get-user-profile", {
        body: { user_id: userId },
      });
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || "Could not load user");
      }
      const u = data.user ?? null;
      if (!u?.id) throw new Error("User not found.");
      setTargetUser(u);
      setForm(staffUserFormFromRow(u));
    } catch (e) {
      setTargetUser(null);
      setProfileError(e?.message || "Could not load user");
    } finally {
      setProfileLoading(false);
    }
  }, [isAdd, userId]);

  useEffect(() => {
    if (isAdd) {
      if (!canCreateUser) {
        navigate(usersListPath, { replace: true });
        return;
      }
      setForm(EMPTY_STAFF_USER_FORM);
      setTargetUser(null);
      setProfileLoading(false);
      return;
    }
    void loadTarget();
  }, [isAdd, canCreateUser, loadTarget, navigate, usersListPath]);

  function isSelf(id) {
    return sessionUserId && id != null && String(id) === sessionUserId;
  }

  async function handleSave(e) {
    e.preventDefault();
    setError("");

    if (isAdd) {
      if (!canCreateUser) return;
    } else {
      if (!targetUser?.id) {
        const msg = "User not loaded. Refresh and try again.";
        setError(msg);
        addToast({ type: "error", message: msg });
        return;
      }
      if (isInactiveLockout(targetUser)) {
        const msg = "Suspended or disabled accounts cannot be edited. Reactivate the account first.";
        setError(msg);
        addToast({ type: "error", message: msg });
        return;
      }
    }

    const validation = validateStaffUserForm(form, { isAdd });
    if (!validation.ok) {
      setError(validation.message);
      addToast({ type: "error", message: validation.message });
      return;
    }

    if (!isAdd && targetUser && !staffUserEditHasChanges(targetUser, form, canAdminister)) {
      addToast({ type: "info", message: MSG_NOTHING_TO_SUBMIT });
      return;
    }

    const prevDerived = targetUser ? deriveUserStatus(targetUser) : undefined;
    const statusIsChanging =
      isAdd || (typeof prevDerived === "string" && form.status !== prevDerived);
    const statusNeedsReason = form.status !== "active";

    if (
      canAdminister &&
      statusIsChanging &&
      statusNeedsReason &&
      !String(form.status_reason || "").trim()
    ) {
      const msg = "A reason is required when setting status to suspended/disabled.";
      setError(msg);
      addToast({ type: "error", message: msg });
      return;
    }

    setLoading(true);
    try {
      let highlightId = null;

      if (isAdd) {
        const ok = await confirm({
          title: "Confirm",
          message: "Create this user? This will add a new user record.",
          confirmLabel: "Create",
          cancelLabel: "Cancel",
        }).catch(() => false);
        if (!ok) return;

        const { data: checkData, error: checkError } = await invokeFn(
          "check-user-details",
          {
            body: {
              id_number: form.id_number,
              phone: form.phone,
              email: form.email,
              country: form.country,
            },
          },
          { withAuth: false },
        );

        if (checkError || !checkData?.success) {
          throw new Error(checkData?.message || checkError?.message || "Could not verify user details");
        }

        const reasonTrim = String(form.status_reason || "").trim();
        const { data, error: invokeError } = await invokeWithAuth("admin-create-user", {
          body: {
            first_name: form.first_name,
            last_name: form.last_name,
            id_number: form.id_number,
            email: form.email,
            phone: form.phone,
            country: form.country,
            date_of_birth: dobInputStr(form.date_of_birth),
            village: form.village,
            ward: form.ward,
            police_station: form.police_station,
            role: canAdminister ? form.role : "user",
            status: canAdminister ? form.status : "active",
            ...(form.status === "suspended" && reasonTrim
              ? { suspended_reason: reasonTrim }
              : {}),
            ...(form.status === "disabled" && reasonTrim
              ? { disabled_reason: reasonTrim }
              : {}),
          },
        });

        if (invokeError || !data?.success) {
          throw new Error(data?.message || invokeError?.message || "Failed to create user");
        }
        if (data?.user?.id != null) highlightId = String(data.user.id);
        addToast({ type: "success", message: "User was created successfully." });
      } else {
        const ok = await confirm({
          title: "Confirm",
          message: "Save changes to this user? This will update the user record immediately.",
          confirmLabel: "Save changes",
          cancelLabel: "Cancel",
        }).catch(() => false);
        if (!ok) return;

        const reasonTrim = String(form.status_reason || "").trim();
        const rowIdNorm = normIdNumber(targetUser.id_number);
        const formIdn = normIdNumber(form.id_number);
        const rowDob = dobFromRow(targetUser);
        const formDob = dobInputStr(form.date_of_birth);
        const updates = {
          first_name: form.first_name,
          last_name: form.last_name,
          email: form.email,
          phone: form.phone,
          country: form.country,
          police_station: form.police_station,
          village: form.village,
          ward: form.ward,
          ...(formIdn !== rowIdNorm ? { id_number: formIdn } : {}),
          ...(formDob !== rowDob ? { date_of_birth: formDob || null } : {}),
          ...(canAdminister
            ? {
                role: form.role,
                status: form.status,
                ...(form.status === "suspended" && reasonTrim
                  ? { suspended_reason: reasonTrim }
                  : {}),
                ...(form.status === "disabled" && reasonTrim
                  ? { disabled_reason: reasonTrim }
                  : {}),
              }
            : {}),
        };

        const { data, error: invokeError } = await invokeWithAuth("update-user", {
          body: { id: targetUser.id, updates },
        });

        if (invokeError || !data?.success) {
          throw new Error(data?.message || invokeError?.message || "Failed to update user");
        }
        if (String(data?.message || "").toLowerCase().includes("no changes")) {
          addToast({ type: "info", message: MSG_NOTHING_TO_SUBMIT });
          goBack(String(targetUser.id));
          return;
        }
        highlightId = String(targetUser.id);
        addToast({ type: "success", message: "User was updated successfully." });
      }

      goBack(highlightId);
    } catch (err) {
      const msg = err?.message || "Failed to save user";
      setError(msg);
      addToast({ type: "error", message: msg });
    } finally {
      setLoading(false);
    }
  }

  const title = isAdd ? NAV_ACTIONS.addUser : NAV_ACTIONS.editUser;
  const editingId = targetUser?.id;
  const subtitle = isAdd
    ? "Create a new registry account with required identity and location details."
    : targetUser
      ? displayUser(targetUser)
      : "Update account details, role, and status.";
  const backHref = returnTo || usersListPath;

  const backAction = (
    <Link
      to={backHref}
      className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-800 text-sm font-semibold shadow-sm hover:bg-gray-50"
    >
      <ArrowLeft size={16} />
      Back to users
    </Link>
  );

  if (!isAdd && profileLoading) {
    return (
      <div className="min-h-[60vh]">
        <PageSectionCard
          maxWidthClass="max-w-7xl"
          title={title}
          subtitle="Loading user…"
          icon={<Pencil className="w-6 h-6 text-iregistrygreen shrink-0" />}
          actions={backAction}
        >
          <div className="p-4 sm:p-6 text-gray-500">Loading user…</div>
        </PageSectionCard>
      </div>
    );
  }

  if (!isAdd && profileError) {
    return (
      <div className="min-h-[60vh]">
        <PageSectionCard
          maxWidthClass="max-w-7xl"
          title={title}
          subtitle={profileError}
          icon={<Pencil className="w-6 h-6 text-iregistrygreen shrink-0" />}
          actions={backAction}
        >
          <div className="p-4 sm:p-6 space-y-4">
            <p className="text-red-700 text-sm">{profileError}</p>
            <RippleButton
              type="button"
              className="px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold"
              onClick={() => goBack()}
            >
              Back to users
            </RippleButton>
          </div>
        </PageSectionCard>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh]">
      <PageSectionCard
        maxWidthClass="max-w-7xl"
        title={title}
        subtitle={subtitle}
        icon={
          isAdd ? (
            <UserPlus className="w-6 h-6 text-iregistrygreen shrink-0" />
          ) : (
            <Pencil className="w-6 h-6 text-iregistrygreen shrink-0" />
          )
        }
        actions={backAction}
      >
        <div className="p-4 sm:p-6 space-y-4">
        {error ? (
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSave} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
          <div>
            <label className="text-xs text-gray-600">
              First name <span className="text-red-600">*</span>
            </label>
            <input
              value={form.first_name}
              onChange={(e) => setForm((s) => ({ ...s, first_name: e.target.value }))}
              className="mt-1 w-full border rounded-lg px-3 py-2"
              placeholder="Thato"
              required
              disabled={loading || profileLoading}
            />
          </div>

          <div>
            <label className="text-xs text-gray-600">
              Last name <span className="text-red-600">*</span>
            </label>
            <input
              value={form.last_name}
              onChange={(e) => setForm((s) => ({ ...s, last_name: e.target.value }))}
              className="mt-1 w-full border rounded-lg px-3 py-2"
              placeholder="Kgosi"
              required
              disabled={loading || profileLoading}
            />
          </div>

          <div>
            <label className="text-xs text-gray-600">
              ID / Passport <span className="text-red-600">*</span>
            </label>
            <input
              value={form.id_number}
              onChange={(e) => setForm((s) => ({ ...s, id_number: e.target.value }))}
              className="mt-1 w-full border rounded-lg px-3 py-2"
              placeholder="12345678901"
              required
              disabled={loading || profileLoading}
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-1">
            <YearMonthDaySelect
              label="Date of birth"
              required={isAdd}
              value={form.date_of_birth}
              onChange={(v) => setForm((s) => ({ ...s, date_of_birth: v }))}
              maxYear={new Date().getFullYear()}
              minYear={1920}
              disabled={loading || profileLoading}
              selectClassName={locationInputClass}
              labelClassName="text-xs text-gray-600 block mb-1"
              showHint={false}
            />
            {!isAdd ? (
              <p className="text-xs text-gray-400 mt-1">
                Optional. Clear year, month, and day to remove stored date of birth.
              </p>
            ) : null}
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            <CountryPhoneInput
              country={form.country}
              phone={form.phone}
              onChange={({ country, phone }) => {
                setForm((s) => ({ ...s, country, phone }));
              }}
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            <TownWardStationSelect
              town={form.village}
              ward={form.ward}
              station=""
              showStation={false}
              requiredTown
              requiredWard
              withAuth={false}
              disabled={loading || profileLoading}
              user={targetUser}
              townLabel="Town / village"
              wardLabel="Ward / street"
              inputClassName={locationInputClass}
              onTownChange={(v) => {
                setForm((s) => {
                  const prev = String(s.village ?? "").trim();
                  const next = String(v ?? "").trim();
                  if (prev === next) return s;
                  return { ...s, village: v, ward: "" };
                });
              }}
              onWardChange={(v) => setForm((s) => ({ ...s, ward: v }))}
              onStationChange={() => {}}
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-3 grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-end">
            <PoliceStationSelect
              label="Nearest police station"
              value={form.police_station}
              onChange={(v) => setForm((s) => ({ ...s, police_station: v }))}
              required
              withAuth={true}
              inputClassName={locationInputClass}
              placeholder={
                canAdminister
                  ? "Search, pick from list, or type a station name…"
                  : "Select police station…"
              }
              allowOther={true}
              variant={canAdminister ? "searchable" : "select"}
              disabled={loading || profileLoading}
            />

            <div className="min-w-0">
              <label className="text-xs text-gray-600">
                Email address {isAdd ? <span className="text-red-600">*</span> : null}
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                className="mt-1 w-full border rounded-lg px-3 py-2"
                placeholder="thato@iregsys.com"
                required={isAdd}
                disabled={loading || profileLoading}
              />
            </div>
          </div>

          {canAdminister ? (
            <>
              <div>
                <label className="text-xs text-gray-600">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((s) => ({ ...s, role: e.target.value }))}
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  disabled={loading || profileLoading || (!isAdd && isSelf(editingId))}
                >
                  <option value="user">User</option>
                  <option value="police">Police</option>
                  <option value="cashier">Cashier</option>
                  <option value="admin">Admin</option>
                </select>
                {!isAdd && isSelf(editingId) ? (
                  <p className="text-xs text-gray-400 mt-1">You cannot change your own role.</p>
                ) : null}
              </div>

              <div>
                <label className="text-xs text-gray-600">Status</label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((s) => ({ ...s, status: e.target.value }))}
                  className="mt-1 w-full border rounded-lg px-3 py-2"
                  disabled={loading || profileLoading || (!isAdd && isSelf(editingId))}
                >
                  {USER_ACCOUNT_STATUS_FORM_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {!isAdd && isSelf(editingId) ? (
                  <p className="text-xs text-gray-400 mt-1">Use another admin account to change your status.</p>
                ) : null}
              </div>
            </>
          ) : null}

          {canAdminister && form.status !== "active" ? (
            <div className="sm:col-span-3">
              <label className="text-xs text-gray-600">Reason for {form.status}</label>
              <textarea
                value={form.status_reason}
                onChange={(e) => setForm((s) => ({ ...s, status_reason: e.target.value }))}
                className="mt-1 w-full border rounded-lg px-3 py-2"
                placeholder="Required"
                required
                disabled={loading || profileLoading}
              />
            </div>
          ) : null}

          <div className="sm:col-span-3 flex gap-2 justify-end pt-2">
            <RippleButton
              type="button"
              className="px-4 py-2 rounded border bg-white disabled:opacity-60"
              onClick={() => goBack()}
              disabled={loading}
            >
              Cancel
            </RippleButton>
            <RippleButton
              type="submit"
              className="px-4 py-2 rounded bg-iregistrygreen text-white disabled:opacity-60"
              disabled={loading || profileLoading}
            >
              {isAdd ? "Create user" : "Save changes"}
            </RippleButton>
          </div>
        </form>
        </div>
      </PageSectionCard>
    </div>
  );
}
