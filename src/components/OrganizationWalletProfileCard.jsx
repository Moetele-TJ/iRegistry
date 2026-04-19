/**
 * Shared mint card: wallet balance plus org details in two columns
 * (registration & location | email & phone). Used on staff org detail and
 * organization workspace pages so layout is consistent across roles.
 */
export default function OrganizationWalletProfileCard({
  organization,
  balance,
  loading = false,
  balanceLabel = "Wallet balance",
}) {
  if (!organization) {
    if (loading) {
      return (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-5 py-5">
          <div className="text-xs font-semibold text-emerald-900/80 uppercase tracking-wide">{balanceLabel}</div>
          <div className="text-3xl font-bold text-emerald-950 tabular-nums mt-1">
            … <span className="text-lg font-semibold text-emerald-900/80">credits</span>
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 px-5 py-5">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,auto)_1fr] lg:gap-10 lg:items-start">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-emerald-900/80 uppercase tracking-wide">{balanceLabel}</div>
          <div className="text-3xl font-bold text-emerald-950 tabular-nums mt-1">
            {loading ? "…" : balance === null ? "—" : balance.toLocaleString()}{" "}
            <span className="text-lg font-semibold text-emerald-900/80">credits</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm text-gray-700 min-w-0">
          {(organization.registration_no || organization.village || organization.ward) && (
            <dl
              className={`min-w-0 space-y-4 ${
                organization.contact_email || organization.phone ? "" : "sm:col-span-2"
              }`}
            >
              {organization.registration_no ? (
                <div>
                  <dt className="text-xs font-semibold text-emerald-900/70 uppercase tracking-wide">Registration</dt>
                  <dd className="mt-0.5 font-mono text-gray-900 break-all">{organization.registration_no}</dd>
                </div>
              ) : null}
              {(organization.village || organization.ward) && (
                <div>
                  <dt className="text-xs font-semibold text-emerald-900/70 uppercase tracking-wide">Location</dt>
                  <dd className="mt-0.5 text-gray-900">
                    {[organization.village, organization.ward].filter(Boolean).join(" · ")}
                  </dd>
                </div>
              )}
            </dl>
          )}
          {(organization.contact_email || organization.phone) && (
            <dl
              className={`min-w-0 space-y-4 ${
                organization.registration_no || organization.village || organization.ward ? "" : "sm:col-span-2"
              }`}
            >
              {organization.contact_email ? (
                <div>
                  <dt className="text-xs font-semibold text-emerald-900/70 uppercase tracking-wide">Email</dt>
                  <dd className="mt-0.5 text-gray-900 break-words">{organization.contact_email}</dd>
                </div>
              ) : null}
              {organization.phone ? (
                <div>
                  <dt className="text-xs font-semibold text-emerald-900/70 uppercase tracking-wide">Phone</dt>
                  <dd className="mt-0.5 text-gray-900 tabular-nums">{organization.phone}</dd>
                </div>
              ) : null}
            </dl>
          )}
        </div>
      </div>
    </div>
  );
}
