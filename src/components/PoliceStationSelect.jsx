import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { invokeFn } from "../lib/invokeFn.js";
import RippleButton from "./RippleButton.jsx";

function norm(v) {
  return String(v ?? "").trim().replace(/\s+/g, " ");
}

/** Searchable dropdown: pick from list or confirm a typed name (replaces native datalist combobox). */
function SearchableStationPicker({
  options,
  value,
  onChange,
  placeholder,
  disabled,
  loading,
  allowOther,
  triggerClassName,
}) {
  const wrapRef = useRef(null);
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const valueNorm = norm(value);

  const sortedOptions = useMemo(
    () => [...options].map((s) => norm(s)).sort((a, b) => a.localeCompare(b)),
    [options],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sortedOptions;
    return sortedOptions.filter((s) => s.toLowerCase().includes(q));
  }, [sortedOptions, query]);

  const exactListedMatch =
    query.trim() !== "" &&
    sortedOptions.some((s) => s.toLowerCase() === query.trim().toLowerCase());

  const canUseTypedName =
    allowOther && query.trim() !== "" && !exactListedMatch;

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setQuery(valueNorm);
  }, [open, valueNorm]);

  const [highlight, setHighlight] = useState(0);
  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const row = listRef.current.children[highlight];
    if (row && row instanceof HTMLElement) {
      row.scrollIntoView({ block: "nearest" });
    }
  }, [highlight, open, filtered.length]);

  function pick(station) {
    onChange?.(station);
    setOpen(false);
    setQuery("");
  }

  function pickTyped() {
    const t = query.trim();
    if (!t) return;
    onChange?.(t);
    setOpen(false);
    setQuery("");
  }

  function onSearchKeyDown(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(0, filtered.length - 1)));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (filtered.length > 0 && highlight < filtered.length) {
        pick(filtered[highlight]);
      } else if (canUseTypedName) {
        pickTyped();
      }
    }
  }

  const busy = disabled || loading;

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <input
          type="text"
          disabled={busy}
          value={open ? query : valueNorm}
          placeholder={loading ? "Loading stations…" : placeholder}
          role="combobox"
          aria-expanded={open}
          aria-controls="police-station-listbox"
          aria-autocomplete="list"
          className={`w-full rounded-lg border border-gray-200 bg-white px-4 py-3 pr-10 text-base transition hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-iregistrygreen focus:ring-offset-0 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-70 ${triggerClassName}`.trim()}
          onFocus={() => {
            if (busy) return;
            setOpen(true);
            setHighlight(0);
            setQuery(valueNorm);
          }}
          onBlur={(e) => {
            // Allow option click (mousedown) to run first.
            window.setTimeout(() => {
              if (!e.currentTarget) return;
              setOpen(false);
              setHighlight(0);
              setQuery("");
            }, 0);
          }}
          onChange={(e) => {
            const next = e.target.value;
            setQuery(next);
            if (!open) setOpen(true);
            if (allowOther) {
              onChange?.(next);
            }
          }}
          onKeyDown={onSearchKeyDown}
        />
        <ChevronDown
          className={`pointer-events-none absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </div>

      {open && !loading ? (
        <div
          className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg"
          role="presentation"
        >
          <ul
            ref={listRef}
            role="listbox"
            className="max-h-56 overflow-y-auto py-1"
            aria-label="Police stations"
            id="police-station-listbox"
          >
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-sm text-gray-500">No matching stations.</li>
            ) : (
              filtered.map((s, i) => (
                <li key={s} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={norm(s) === valueNorm}
                    className={`flex w-full px-4 py-2.5 text-left text-sm transition ${
                      i === highlight ? "bg-emerald-50 text-gray-900" : "text-gray-800 hover:bg-gray-50"
                    } ${norm(s) === valueNorm ? "font-medium text-iregistrygreen" : ""}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(s);
                    }}
                  >
                    {s}
                  </button>
                </li>
              ))
            )}
          </ul>

          {canUseTypedName ? (
            <div className="border-t border-gray-100 bg-gray-50 px-3 py-2">
              <button
                type="button"
                className="w-full rounded-lg py-2 text-left text-sm font-medium text-iregistrygreen hover:bg-emerald-50/80"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pickTyped();
                }}
              >
                {`Use "${query.trim()}" as station name`}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function PoliceStationSelect({
  value,
  onChange,
  label = "Police station",
  required = false,
  disabled = false,
  placeholder = "Select a police station…",
  allowOther = true,
  variant = "select", // "select" | "combobox" | "searchable" (combobox uses searchable UI)
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

  const useSearchable =
    variant === "searchable" || variant === "combobox";

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
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {label} {required ? <span className="text-red-600">*</span> : null}
        </label>
      ) : null}

      {options.length > 0 && useSearchable ? (
        <SearchableStationPicker
          options={options}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          loading={loading}
          allowOther={allowOther}
          triggerClassName={inputClassName.replace(/\bw-full\b/g, "").trim()}
        />
      ) : options.length > 0 ? (
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
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 disabled:opacity-60"
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
