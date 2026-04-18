import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Building2, Check, X, RefreshCw, Wallet } from "lucide-react";
import PageSectionCard from "../shared/PageSectionCard.jsx";
import RippleButton from "../../components/RippleButton.jsx";
import { useOrganizations } from "../../hooks/useOrganizations.js";
import { orgPathSegment } from "../../lib/orgPath.js";

function orgLabel(org) {
  return String(org?.name || "").trim() || org?.registration_no || org?.id || "—";
}

export default function UserOrganizationsPage() {
  const {
    invites,
    activeMemberships,
    loading,
    saving,
    error,
    refresh,
    respondInvite,
  } = useOrganizations();

  const inviteRows = useMemo(() => invites || [], [invites]);
  const activeRows = useMemo(() => activeMemberships || [], [activeMemberships]);

  return (
    <PageSectionCard
      maxWidthClass="max-w-7xl"
      title="Organizations"
      subtitle="Manage your organization memberships and invitations."
      icon={<Building2 className="w-6 h-6 text-iregistrygreen shrink-0" />}
      actions={
        <RippleButton
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 shadow-sm hover:bg-gray-50"
          onClick={() => void refresh()}
          disabled={loading}
        >
          <RefreshCw size={16} />
          Refresh
        </RippleButton>
      }
    >
      <div className="p-4 sm:p-6 space-y-8">
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm">
            {error}
          </div>
        ) : null}

        <section>
          <div className="text-sm font-semibold text-gray-800 mb-3">Invitations</div>
          {loading ? (
            <div className="text-sm text-gray-500">Loading…</div>
          ) : inviteRows.length === 0 ? (
            <div className="text-sm text-gray-500">No pending invitations.</div>
          ) : (
            <div className="space-y-3">
              {inviteRows.map((m) => (
                <div
                  key={m.org.id}
                  className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 truncate">{orgLabel(m.org)}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      Role: <span className="font-mono">{m.role}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <RippleButton
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-iregistrygreen text-white text-sm font-semibold disabled:opacity-60"
                      disabled={saving}
                      onClick={() => void respondInvite({ orgId: m.org.id, action: "accept" })}
                    >
                      <Check size={16} />
                      Accept
                    </RippleButton>
                    <RippleButton
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-red-200 text-red-700 bg-white text-sm font-semibold disabled:opacity-60"
                      disabled={saving}
                      onClick={() => void respondInvite({ orgId: m.org.id, action: "reject" })}
                    >
                      <X size={16} />
                      Reject
                    </RippleButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="text-sm font-semibold text-gray-800 mb-3">My organizations</div>
          {loading ? (
            <div className="text-sm text-gray-500">Loading…</div>
          ) : activeRows.length === 0 ? (
            <div className="text-sm text-gray-500">
              You are not a member of any organization yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeRows.map((m) => (
                <div key={m.org.id} className="rounded-2xl border border-gray-100 bg-white shadow-sm p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900 truncate">{orgLabel(m.org)}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        Your role: <span className="font-mono">{m.role}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 justify-end">
                      <Link
                        to={`/organizations/${orgPathSegment(m.org)}/wallet`}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-800 text-sm font-semibold hover:bg-gray-50"
                      >
                        <Wallet size={16} />
                        Wallet
                      </Link>
                      <Link
                        to={`/organizations/${orgPathSegment(m.org)}/items`}
                        className="inline-flex items-center justify-center px-3 py-2 rounded-xl border border-emerald-200 bg-white text-emerald-900 text-sm font-semibold hover:bg-emerald-50"
                      >
                        View items
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </PageSectionCard>
  );
}

