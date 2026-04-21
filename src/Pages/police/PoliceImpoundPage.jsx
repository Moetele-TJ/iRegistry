import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Shield, Search, ClipboardCheck, CheckCircle2, Info } from "lucide-react";
import PageSectionCard from "../shared/PageSectionCard.jsx";
import RippleButton from "../../components/RippleButton.jsx";
import { invokeWithAuth } from "../../lib/invokeWithAuth.js";
import { useToast } from "../../contexts/ToastContext.jsx";
import CategoryMakeModelSelect from "../../components/CategoryMakeModelSelect.jsx";

export default function PoliceImpoundPage() {
  const { addToast } = useToast();
  const [serial, setSerial] = useState("");
  const [serial2, setSerial2] = useState("");
  const [category, setCategory] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [lookup, setLookup] = useState(null);
  const [result, setResult] = useState(null);

  const canSubmit = useMemo(() => String(serial || "").trim().length > 0, [serial]);

  async function checkSerial(e) {
    e?.preventDefault?.();
    const s = String(serial || "").trim();
    if (!s) {
      addToast({ type: "error", message: "Serial is required." });
      return;
    }
    setLoading(true);
    setResult(null);
    setLookup(null);
    setSerial2("");
    setCategory("");
    setMake("");
    setModel("");
    setNotes("");
    try {
      const { data, error } = await invokeWithAuth("police-lookup-serial", { body: { serial: s } });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed");
      setLookup(data);
    } catch (err) {
      addToast({ type: "error", message: err.message || "Failed" });
    } finally {
      setLoading(false);
    }
  }

  async function submitFoundReport(e) {
    e?.preventDefault?.();
    const s = String(serial || "").trim();
    if (!s) {
      addToast({ type: "error", message: "Serial is required." });
      return;
    }
    // When no match is found, require notes so the report is actionable.
    if (!lookup?.match && !String(notes || "").trim()) {
      addToast({ type: "error", message: "Notes are required when no match is found." });
      return;
    }
    if (!lookup?.match) {
      if (!String(category || "").trim() || !String(make || "").trim() || !String(model || "").trim()) {
        addToast({ type: "error", message: "Category, make, and model are required when no match is found." });
        return;
      }
    }
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await invokeWithAuth("police-impound-item", {
        body: {
          serial: s,
          serial2: String(serial2 || "").trim() || null,
          notes: String(notes || "").trim() || null,
          category: String(category || "").trim() || null,
          make: String(make || "").trim() || null,
          model: String(model || "").trim() || null,
        },
      });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Failed");
      setResult(data.result || null);
      if (data?.result?.state === "FOUND") {
        addToast({ type: "success", message: "Message sent to the registered owner. Station case opened." });
      } else {
        addToast({ type: "success", message: "Found item recorded. It will match if the owner registers later." });
      }
    } catch (err) {
      addToast({ type: "error", message: err.message || "Failed" });
    } finally {
      setLoading(false);
    }
  }

  const match = lookup?.match || null;
  const officerStation = String(lookup?.officer_station || "").trim();
  const matchLabel = useMemo(() => {
    if (!match) return "";
    const mm = [match.make, match.model].map((x) => String(x || "").trim()).filter(Boolean).join(" ");
    return mm || String(match.name || "").trim() || "Registered item";
  }, [match]);

  return (
    <PageSectionCard
      maxWidthClass="max-w-4xl"
      title="Impound / register found item"
      subtitle="Check a serial number first. If it matches a registered item, you can notify the owner and open a station case. If not, fill in details to record a found-item report."
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
      <div className="p-4 sm:p-6 space-y-4">
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

          <div className="flex justify-end gap-2">
            <RippleButton
              type="button"
              onClick={checkSerial}
              disabled={!canSubmit || loading}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-iregistrygreen text-white font-semibold disabled:opacity-60"
            >
              <ClipboardCheck size={18} />
              {loading ? "Checking…" : "Check serial"}
            </RippleButton>
          </div>
        </div>

        {lookup ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Officer station</div>
                <div className="text-sm text-gray-900 font-semibold">{officerStation || "—"}</div>
              </div>
              <div className="shrink-0 text-xs text-gray-500 font-mono">
                Normalized: {String(lookup.serial_normalized || "—")}
              </div>
            </div>

            {match ? (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4 space-y-2">
                <div className="flex items-center gap-2 text-emerald-900 font-semibold">
                  <CheckCircle2 size={18} className="text-emerald-700" />
                  Match found in registry
                </div>
                <div className="text-sm text-gray-800">
                  Item: <span className="font-semibold">{matchLabel}</span>
                </div>
                <div className="text-sm text-gray-800 font-mono">Serial: {String(serial || "").trim()}</div>
                <div className="text-xs text-gray-700 flex items-start gap-2">
                  <Info size={14} className="text-gray-500 mt-0.5 shrink-0" />
                  <span>
                    Submitting will notify the registered owner and open a police recovery case under{" "}
                    <span className="font-semibold">{officerStation}</span>. This does not confirm ownership; the owner must still provide proof to the station.
                  </span>
                </div>

                <label className="block pt-2">
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
                    type="button"
                    onClick={submitFoundReport}
                    disabled={loading}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 text-white font-semibold disabled:opacity-60"
                  >
                    <ClipboardCheck size={18} />
                    {loading ? "Sending…" : "Notify owner & open case"}
                  </RippleButton>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4 space-y-2">
                <div className="text-amber-900 font-semibold">No match found</div>
                <div className="text-sm text-gray-800">
                  A report will be saved for future matching. Please include enough detail for follow-up.
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="sm:col-span-3">
                    <CategoryMakeModelSelect
                      category={category}
                      make={make}
                      model={model}
                      required={true}
                      onCategoryChange={(v) => {
                        setCategory(v);
                        setMake("");
                        setModel("");
                      }}
                      onMakeChange={(v) => {
                        setMake(v);
                        setModel("");
                      }}
                      onModelChange={(v) => setModel(v)}
                    />
                  </div>
                </div>

                <label className="block pt-2">
                  <div className="text-sm font-semibold text-gray-800">Serial #2 (optional)</div>
                  <input
                    value={serial2}
                    onChange={(e) => setSerial2(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-mono"
                    placeholder="Secondary serial, if present"
                  />
                </label>

                <label className="block pt-2">
                  <div className="text-sm font-semibold text-gray-800">Notes *</div>
                  <textarea
                    rows={4}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                    placeholder="Describe where/when found, identifying marks, evidence summary, etc."
                  />
                </label>

                <div className="flex justify-end">
                  <RippleButton
                    type="button"
                    onClick={submitFoundReport}
                    disabled={loading}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-iregistrygreen text-white font-semibold disabled:opacity-60"
                  >
                    <ClipboardCheck size={18} />
                    {loading ? "Saving…" : "Submit report"}
                  </RippleButton>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {result ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-4">
            <div className="text-xs uppercase tracking-wide text-gray-500 font-semibold mb-2">Outcome</div>
            {result.state === "FOUND" ? (
              <div className="space-y-2">
                <div className="text-sm text-gray-800">
                  Message sent to registered owner for{" "}
                  <span className="font-semibold">
                    {result.item?.make || result.item?.model ? `${result.item?.make || ""} ${result.item?.model || ""}`.trim() : (result.item?.name || result.item?.id)}
                  </span>
                  .
                </div>
                <div className="text-sm text-gray-700">
                  Station case opened under <span className="font-semibold">{officerStation || "your station"}</span>.
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
                <div className="text-sm text-gray-800">No match found. Report saved for future matching.</div>
                <div className="text-xs text-gray-500 font-mono">Report: {result.report?.id}</div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </PageSectionCard>
  );
}

