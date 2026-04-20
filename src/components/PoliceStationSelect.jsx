import { useEffect, useMemo, useState } from "react";
import { invokeFn } from "../lib/invokeFn.js";
import RippleButton from "./RippleButton.jsx";

function norm(v) {
  return String(v ?? "").trim().replace(/\s+/g, " ");
}

export default function PoliceStationSelect({
  value,
  onChange,
  label = "Police station",
  required = false,
  disabled = false,
  placeholder = "Select a police station…",
  allowOther = true,
  inputClassName = "w-full border rounded-lg px-4 py-2",
  withAuth = true,
  helpText,
}) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const valueNorm = norm(value);
  const known = useMemo(() => {
    if (!valueNorm) return true;
    return options.some((s) => norm(s).toLowerCase() === valueNorm.toLowerCase());
  }, [options, valueNorm]);

  const selectValue = !valueNorm ? "" : known ? valueNorm : "__OTHER__";

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const { data, error } = await invokeFn("list-police-stations", {}, { withAuth });
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || "Failed to load stations");
      }
      setOptions(Array.isArray(data.stations) ? data.stations : []);
    } catch (e) {
      setOptions([]);
      setErr(e?.message || "Failed to load stations");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-2">
      {label ? (
        <label className="block text-sm mb-1">
          {label} {required ? <span className="text-red-600">*</span> : null}
        </label>
      ) : null}

      {options.length > 0 ? (
        <>
          <select
            className={inputClassName}
            value={selectValue}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "__OTHER__") {
                onChange?.(valueNorm);
              } else {
                onChange?.(v);
              }
            }}
            disabled={disabled || loading}
          >
            <option value="">{placeholder}</option>
            {options.map((s) => (
              <option key={String(s)} value={norm(s)}>
                {norm(s)}
              </option>
            ))}
            {allowOther ? <option value="__OTHER__">Other…</option> : null}
          </select>

          {allowOther && selectValue === "__OTHER__" ? (
            <input
              className={inputClassName}
              placeholder="Enter station name"
              value={valueNorm}
              onChange={(e) => onChange?.(e.target.value)}
              disabled={disabled}
            />
          ) : null}
        </>
      ) : (
        <div className="space-y-2">
          <input
            className={inputClassName}
            value={valueNorm}
            onChange={(e) => onChange?.(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
          />
          <div className="flex items-center gap-2">
            <RippleButton
              type="button"
              className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 font-semibold disabled:opacity-60"
              onClick={() => void load()}
              disabled={disabled || loading}
            >
              {loading ? "Loading stations…" : "Load stations list"}
            </RippleButton>
            {err ? <div className="text-xs text-amber-700">{err}</div> : null}
          </div>
        </div>
      )}

      {helpText ? <div className="text-xs text-gray-500">{helpText}</div> : null}
      {options.length > 0 && err ? <div className="text-xs text-amber-700">{err}</div> : null}
    </div>
  );
}

