import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, RefreshCw, Search } from "lucide-react";
import PageSectionCard from "./PageSectionCard.jsx";
import RippleButton from "../../components/RippleButton.jsx";
import { invokeWithAuth } from "../../lib/invokeWithAuth.js";
import { useToast } from "../../contexts/ToastContext.jsx";

function orgLabel(o) {
  return String(o?.name || "").trim() || o?.registration_no || o?.id || "—";
}

export default function StaffOrganizationsPage({ title = "Organizations", subtitle = "Browse organizations." }) {
  const { addToast } = useToast();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const staffBasePath =
    typeof window !== "undefined" && window.location?.pathname?.startsWith("/cashier")
      ? "/cashier"
      : "/admin";

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await invokeWithAuth("list-orgs", {
        body: { q: q.trim() || "", limit: 200 },
      });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed");
      setRows(Array.isArray(data.organizations) ? data.organizations : []);
    } catch (e) {
      addToast({ type: "error", message: e.message || "Failed to load organizations" });
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const organizations = useMemo(() => rows || [], [rows]);

  return (
    <PageSectionCard
      maxWidthClass="max-w-7xl"
      title={title}
      subtitle={subtitle}
      icon={<Building2 className="w-6 h-6 text-iregistrygreen shrink-0" />}
      actions={
        <RippleButton
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-800 shadow-sm hover:bg-gray-50"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw size={16} />
          Refresh
        </RippleButton>
      }
    >
      <div className="p-4 sm:p-6 space-y-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <div className="relative w-full sm:w-[420px] max-w-full">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or registration number…"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 bg-white text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") void load();
              }}
            />
          </div>
          <RippleButton
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-iregistrygreen text-white font-semibold disabled:opacity-60"
            disabled={loading}
            onClick={() => void load()}
          >
            Search
          </RippleButton>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white overflow-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left font-semibold px-4 py-3">Organization</th>
                <th className="text-left font-semibold px-4 py-3">Registration</th>
                <th className="text-left font-semibold px-4 py-3">Contact</th>
                <th className="text-right font-semibold px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td className="px-4 py-8 text-gray-500" colSpan={4}>
                    Loading…
                  </td>
                </tr>
              ) : organizations.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-gray-500" colSpan={4}>
                    No organizations found.
                  </td>
                </tr>
              ) : (
                organizations.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">{orgLabel(o)}</div>
                      <div className="text-xs text-gray-500 font-mono">{String(o.id).slice(0, 8)}…</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{o.registration_no || "—"}</td>
                    <td className="px-4 py-3 text-gray-700">
                      <div className="text-xs">{o.contact_email || "—"}</div>
                      <div className="text-xs">{o.phone || ""}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Link
                          to={`/organizations/${o.id}/items`}
                          className="inline-flex items-center justify-center px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-800 text-xs font-semibold hover:bg-gray-50"
                        >
                          Items
                        </Link>
                        <Link
                          to={`/organizations/${o.id}/wallet`}
                          className="inline-flex items-center justify-center px-3 py-2 rounded-xl border border-emerald-200 bg-white text-emerald-900 text-xs font-semibold hover:bg-emerald-50"
                        >
                          Wallet
                        </Link>
                        <Link
                          to={`/organizations/${o.id}/transactions`}
                          className="inline-flex items-center justify-center px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-800 text-xs font-semibold hover:bg-gray-50"
                        >
                          Transactions
                        </Link>
                        <Link
                          to={`${staffBasePath}/organizations/${o.id}/add-member`}
                          className="inline-flex items-center justify-center px-3 py-2 rounded-xl border border-emerald-200 bg-white text-emerald-900 text-xs font-semibold hover:bg-emerald-50"
                          title="Create a user and add them as a member (2 credits)"
                        >
                          Add member
                        </Link>
                      </div>
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

