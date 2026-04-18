import { useSearchParams } from "react-router-dom";
import StaffOrgTransferRequestsPage from "../shared/StaffOrgTransferRequestsPage.jsx";
import PendingTransferRequests from "../../components/PendingTransferRequests.jsx";

export default function AdminTransfersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get("view") === "organization" ? "organization" : "individual";

  function setView(next) {
    if (next === "individual") {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ view: "organization" }, { replace: true });
    }
  }

  return (
    <div className="max-w-7xl mx-auto w-full space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-iregistrygreen tracking-tight">Transfer requests</h1>
          <p className="text-sm text-gray-500 mt-1">
            Switch between individual (buyer ↔ owner) requests and organization-assisted transfers.
          </p>
        </div>

        <div
          className="inline-flex shrink-0 rounded-2xl border border-emerald-200/80 bg-emerald-50/60 p-1 shadow-sm"
          role="tablist"
          aria-label="Transfer type"
        >
          <button
            type="button"
            role="tab"
            aria-selected={view === "individual"}
            onClick={() => setView("individual")}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
              view === "individual"
                ? "bg-white text-emerald-900 shadow-sm ring-1 ring-emerald-200/80"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Individual
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "organization"}
            onClick={() => setView("organization")}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
              view === "organization"
                ? "bg-white text-emerald-900 shadow-sm ring-1 ring-emerald-200/80"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Organization
          </button>
        </div>
      </div>

      {view === "individual" ? (
        <PendingTransferRequests showWhenEmpty />
      ) : (
        <StaffOrgTransferRequestsPage />
      )}
    </div>
  );
}
