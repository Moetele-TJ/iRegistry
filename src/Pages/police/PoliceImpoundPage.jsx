import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Shield, Search, ClipboardCheck } from "lucide-react";
import PageSectionCard from "../shared/PageSectionCard.jsx";
import RippleButton from "../../components/RippleButton.jsx";
import { invokeWithAuth } from "../../lib/invokeWithAuth.js";
import { useToast } from "../../contexts/ToastContext.jsx";

export default function PoliceImpoundPage() {
  const { addToast } = useToast();
  const [serial, setSerial] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const canSubmit = useMemo(() => String(serial || "").trim().length > 0, [serial]);

  async function submit(e) {
    e?.preventDefault?.();
    const s = String(serial || "").trim();
    if (!s) {
      addToast({ type: "error", message: "Serial is required." });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await invokeWithAuth("police-impound-item", {
        body: { serial: s, notes: String(notes || "").trim() || null },
      });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed");
      setResult(data.result || null);
      if (data?.result?.state === "FOUND") {
        addToast({ type: "success", message: "Match found. Owner notified and station case opened." });
      } else {
        addToast({ type: "success", message: "Recorded. This will match when the owner registers later." });
      }
    } catch (err) {
      addToast({ type: "error", message: err.message || "Failed" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageSectionCard
      maxWidthClass="max-w-4xl"
      title="Impound / register found item"
      subtitle="Enter a serial number. If it matches a registered item, the owner is notified. If not, we record it for future matching."
      icon={<Shield className="w-7 h-7 text-iregistrygreen shrink-0" />}
      actions={
        <Link
          to="/police/items"
          className="inline-flex items-center justify-center px-3 py-2 rounded-xl border border-gray-200 bg-white text-gray-800 text-sm font-semibold hover:bg-gray-50"
        >
          Back to station queue
        </Link>
      }
    >
      <form onSubmit={submit} className="p-4 sm:p-6 space-y-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
          <label className="block">
            <div className="text-sm font-semibold text-gray-800">Serial number *</div>
            <div className="relative mt-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-mono"
                placeholder="Enter serial…"
              />
            </div>
          </label>

          <label className="block">
            <div className="text-sm font-semibold text-gray-800">Notes (optional)</div>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
              placeholder="Where/when found, evidence summary, etc."
            />
          </label>

          <div className="flex justify-end">
            <RippleButton
              type="submit"
              disabled={!canSubmit || loading}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-iregistrygreen text-white font-semibold disabled:opacity-60"
            >
              <ClipboardCheck size={18} />
              {loading ? "Saving…" : "Check & record"}
            </RippleButton>
          </div>
        </div>

        {result ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <div className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2">Result</div>
            {result.state === "FOUND" ? (
              <div className="space-y-2">
                <div className="text-sm text-gray-800">
                  Match found: <span className="font-semibold">{result.item?.name || result.item?.id}</span>
                </div>
                {result.item?.slug ? (
                  <Link className="text-sm text-emerald-800 hover:underline" to={`/items/${result.item.slug}`}>
                    View item details
                  </Link>
                ) : null}
                <div className="text-xs text-gray-500 font-mono">Report: {result.report?.id}</div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-sm text-gray-800">
                  No match found. Recorded for future matching.
                </div>
                <div className="text-xs text-gray-500 font-mono">Report: {result.report?.id}</div>
              </div>
            )}
          </div>
        ) : null}
      </form>
    </PageSectionCard>
  );
}

