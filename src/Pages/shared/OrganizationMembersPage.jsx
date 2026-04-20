import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Building2, RefreshCw, UserPlus, Users, X } from "lucide-react";
import PageSectionCard from "./PageSectionCard.jsx";
import RippleButton from "../../components/RippleButton.jsx";
import { invokeWithAuth } from "../../lib/invokeWithAuth.js";
import { useToast } from "../../contexts/ToastContext.jsx";
import { useOrgRouteResolution } from "../../hooks/useOrgRouteResolution.js";

function displayName(u) {
  const first = String(u?.first_name || "").trim();
  const last = String(u?.last_name || "").trim();
  const full = `${first} ${last}`.trim();
  return full || u?.email || u?.id_number || u?.id || "—";
}

function compact(v) {
  const s = String(v ?? "").trim();
  return s || "—";
}

function actorRoleFallbackCanManage(role) {
  const u = String(role || "").toUpperCase();
  return u === "ORG_ADMIN" || u === "STAFF";
}

export default function OrganizationMembersPage() {
  const { orgKey, orgId } = useOrgRouteResolution();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actorRole, setActorRole] = useState(null);
  const [canManageMembers, setCanManageMembers] = useState(false);
  const [members, setMembers] = useState([]);
  const [error, setError] = useState(null);

  const [inviteUserId, setInviteUserId] = useState("");
  const [inviteRole, setInviteRole] = useState("ORG_MEMBER");
  const [includeInvited, setIncludeInvited] = useState(true);

  const rows = useMemo(() => members || [], [members]);

  async function load() {
    if (!orgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await invokeWithAuth("list-org-members", {
        body: { org_id: orgId, includeInvited },
      });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed to load members");
      setMembers(Array.isArray(data.members) ? data.members : []);
      setActorRole(data.actor_role || null);
      setCanManageMembers(
        data.can_manage_members === true ||
          data.can_invite === true ||
          actorRoleFallbackCanManage(data.actor_role),
      );
    } catch (e) {
      setError(e.message || "Failed to load members");
      setMembers([]);
      setActorRole(null);
      setCanManageMembers(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, includeInvited]);

  async function invite() {
    if (!inviteUserId.trim()) {
      addToast({ type: "error", message: "Enter a user id." });
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await invokeWithAuth("invite-org-member", {
        body: { org_id: orgId, user_id: inviteUserId.trim(), role: inviteRole },
      });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed to invite");
      addToast({ type: "success", message: "Invitation sent." });
      setInviteUserId("");
      await load();
    } catch (e) {
      addToast({ type: "error", message: e.message || "Failed" });
    } finally {
      setSaving(false);
    }
  }

  async function changeRole(userId, nextRole) {
    setSaving(true);
    try {
      const { data, error } = await invokeWithAuth("org-update-member-role", {
        body: { org_id: orgId, user_id: userId, role: nextRole },
      });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed");
      addToast({ type: "success", message: "Role updated." });
      await load();
    } catch (e) {
      addToast({ type: "error", message: e.message || "Failed" });
    } finally {
      setSaving(false);
    }
  }

  async function removeMember(userId) {
    setSaving(true);
    try {
      const { data, error } = await invokeWithAuth("org-remove-member", {
        body: { org_id: orgId, user_id: userId, reason: null },
      });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed");
      addToast({ type: "success", message: "Member removed." });
      await load();
    } catch (e) {
      addToast({ type: "error", message: e.message || "Failed" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageSectionCard
      maxWidthClass="max-w-7xl"
      title="Organization members"
      subtitle="Invite users and manage membership roles."
      icon={<Users className="w-6 h-6 text-iregistrygreen shrink-0" />}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/organizations/${orgKey}/items`}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 shadow-sm hover:bg-gray-50"
          >
            <Building2 size={16} />
            Items
          </Link>
          <RippleButton
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 shadow-sm hover:bg-gray-50"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw size={16} />
            Refresh
          </RippleButton>
        </div>
      }
    >
      <div className="p-4 sm:p-6 space-y-5">
        <Link
          to="/user/organizations"
          className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800 hover:text-emerald-900"
        >
          <ArrowLeft size={16} />
          Back to organizations
        </Link>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm">{error}</div>
        ) : null}

        <div className="rounded-2xl border border-gray-100 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-1">Members</div>
              <div className="text-sm text-gray-700">
                Your role: <span className="font-mono">{actorRole || "—"}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <input
                id="includeInvited"
                type="checkbox"
                checked={includeInvited}
                onChange={(e) => setIncludeInvited(e.target.checked)}
              />
              <label htmlFor="includeInvited">Show pending invitations</label>
            </div>
          </div>

          {canManageMembers ? (
            <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3">
                <div className="flex-1">
                  <div className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-1">Invite member</div>
                  <div className="text-sm text-gray-700">
                    Paste the user&apos;s <span className="font-mono">user_id</span> to send an invitation.
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
                  <div className="min-w-[280px]">
                    <label className="text-xs text-gray-600">User ID</label>
                    <input
                      value={inviteUserId}
                      onChange={(e) => setInviteUserId(e.target.value)}
                      className="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-white"
                      placeholder="uuid…"
                    />
                  </div>
                  <div className="min-w-[200px]">
                    <label className="text-xs text-gray-600">Role</label>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                      className="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-white"
                    >
                      <option value="ORG_MEMBER">Member</option>
                      <option value="ORG_MANAGER">Manager</option>
                      <option value="ORG_ADMIN">Administrator</option>
                    </select>
                  </div>
                  <RippleButton
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-iregistrygreen text-white font-semibold disabled:opacity-60"
                    disabled={saving}
                    onClick={() => void invite()}
                  >
                    <UserPlus size={18} />
                    Invite
                  </RippleButton>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-3 text-sm text-gray-700">
              Invitations and role changes are limited to organization administrators and registry staff.
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left font-semibold px-4 py-3">User</th>
                <th className="text-left font-semibold px-4 py-3">Contacts</th>
                <th className="text-left font-semibold px-4 py-3">Address</th>
                <th className="text-left font-semibold px-4 py-3">Status</th>
                <th className="text-left font-semibold px-4 py-3">Role</th>
                <th className="text-right font-semibold px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-gray-500" colSpan={6}>
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-gray-500" colSpan={6}>
                    No members found.
                  </td>
                </tr>
              ) : (
                rows.map((m) => (
                  <tr key={m.user_id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">{displayName(m.user)}</div>
                      <div className="text-xs text-gray-500 font-mono">{String(m.user_id).slice(0, 8)}…</div>
                      <div className="text-xs text-gray-600 mt-1">
                        ID: <span className="font-mono">{compact(m.user?.id_number)}</span>
                        {" · "}
                        DOB: <span className="font-mono">{compact(m.user?.date_of_birth)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <div className="text-xs">{compact(m.user?.phone)}</div>
                      <div className="text-xs">{compact(m.user?.email)}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <div className="text-xs">Village: {compact(m.user?.village)}</div>
                      <div className="text-xs">Ward: {compact(m.user?.ward)}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{m.status}</td>
                    <td className="px-4 py-3">
                      <select
                        value={m.role}
                        disabled={saving || !canManageMembers}
                        onChange={(e) => void changeRole(m.user_id, e.target.value)}
                        className="border rounded-xl px-3 py-2 text-sm bg-white disabled:opacity-60"
                      >
                        <option value="ORG_MEMBER">Member</option>
                        <option value="ORG_MANAGER">Manager</option>
                        <option value="ORG_ADMIN">Administrator</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <RippleButton
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-red-200 text-red-700 bg-white text-xs font-semibold disabled:opacity-60"
                        disabled={saving || !canManageMembers}
                        onClick={() => void removeMember(m.user_id)}
                        title="Remove member"
                      >
                        <X size={14} />
                        Remove
                      </RippleButton>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </PageSectionCard>
  );
}

