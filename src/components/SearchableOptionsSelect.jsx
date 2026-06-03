import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import RippleButton from "./RippleButton.jsx";

export function normOption(v) {
  return String(v ?? "").trim().replace(/\s+/g, " ");
}

/** Searchable dropdown: pick from list or confirm a typed value (same UX as police station). */
function SearchableListPicker({
  options,
  value,
  onChange,
  placeholder,
  disabled,
  loading,
  allowOther,
  triggerClassName,
  listboxId,
  listboxAriaLabel,
  emptyNoMatchMessage,
  typedValueLabel,
  loadingPlaceholder,
}) {
  const wrapRef = useRef(null);
  const listRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const valueNorm = normOption(value);

  const sortedOptions = useMemo(
    () => [...options].map((s) => normOption(s)).sort((a, b) => a.localeCompare(b)),
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

  function pick(option) {
    onChange?.(option);
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
  const loadPh = loadingPlaceholder || "Loading options…";

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <input
          type="text"
          disabled={busy}
          value={open ? query : valueNorm}
          placeholder={loading ? loadPh : placeholder}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          className={`w-full rounded-lg border border-gray-200 bg-white px-4 py-3 pr-10 text-base transition hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-iregistrygreen focus:ring-offset-0 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-70 ${triggerClassName}`.trim()}
          onFocus={() => {
            if (busy) return;
            setOpen(true);
            setHighlight(0);
            setQuery(valueNorm);
          }}
          onBlur={(e) => {
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
            aria-label={listboxAriaLabel}
            id={listboxId}
          >
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-sm text-gray-500">{emptyNoMatchMessage}</li>
            ) : (
              filtered.map((s, i) => (
                <li key={s} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={normOption(s) === valueNorm}
                    className={`flex w-full px-4 py-2.5 text-left text-sm transition ${
                      i === highlight ? "bg-emerald-50 text-gray-900" : "text-gray-800 hover:bg-gray-50"
                    } ${normOption(s) === valueNorm ? "font-medium text-iregistrygreen" : ""}`}
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
                {typedValueLabel(query.trim())}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Loads options async, then shows the same searchable picker as PoliceStationSelect.
 */
export default function SearchableOptionsSelect({
  value,
  onChange,
  label,
  required = false,
  disabled = false,
  placeholder = "Select or type…",
  allowOther = true,
  variant = "searchable",
  inputClassName = "w-full border rounded-lg px-4 py-2",
  helpText,
  loadOptions,
  reloadKey = 0,
  loadingPlaceholder = "Loading options…",
  retryLabel = "Load list",
  listboxAriaLabel = "Options",
  emptyNoMatchMessage = "No matching options.",
  typedValueLabel = (q) => `Use "${q}"`,
}) {
  const listboxId = useId();
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const valueNorm = normOption(value);
  const known = useMemo(() => {
    if (!valueNorm) return true;
    return options.some((s) => normOption(s).toLowerCase() === valueNorm.toLowerCase());
  }, [options, valueNorm]);

  const selectValue = !valueNorm ? "" : known ? valueNorm : "__OTHER__";
  const useSearchable = variant === "searchable" || variant === "combobox";

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const list = await loadOptions();
      setOptions(Array.isArray(list) ? list : []);
    } catch (e) {
      setOptions([]);
      setErr(e?.message || "Failed to load options");
    } finally {
      setLoading(false);
    }
  }, [loadOptions]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const triggerClassName = inputClassName.replace(/\bw-full\b/g, "").trim();

  return (
    <div className="space-y-2">
      {label ? (
        <label className="mb-1 block text-sm font-medium text-gray-700">
          {label} {required ? <span className="text-red-600">*</span> : null}
        </label>
      ) : null}

      {options.length > 0 && useSearchable ? (
        <SearchableListPicker
          options={options}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          loading={loading}
          allowOther={allowOther}
          triggerClassName={triggerClassName}
          listboxId={listboxId}
          listboxAriaLabel={listboxAriaLabel}
          emptyNoMatchMessage={emptyNoMatchMessage}
          typedValueLabel={typedValueLabel}
          loadingPlaceholder={loadingPlaceholder}
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
              <option key={String(s)} value={normOption(s)}>
                {normOption(s)}
              </option>
            ))}
            {allowOther ? <option value="__OTHER__">Other…</option> : null}
          </select>

          {allowOther && selectValue === "__OTHER__" ? (
            <input
              className={inputClassName}
              placeholder="Enter value"
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
            placeholder={loading ? loadingPlaceholder : placeholder}
            disabled={disabled || loading}
          />
          <div className="flex items-center gap-2">
            <RippleButton
              type="button"
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 disabled:opacity-60"
              onClick={() => void load()}
              disabled={disabled || loading}
            >
              {loading ? loadingPlaceholder : retryLabel}
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
