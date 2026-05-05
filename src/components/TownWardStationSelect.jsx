import { useEffect, useId, useMemo, useRef, useState } from "react";

function norm(v) {
  return String(v ?? "").trim().replace(/\s+/g, " ");
}

function uniqSorted(values) {
  const set = new Set(values.map(norm).filter(Boolean));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function ComboboxInput({
  label,
  value,
  onChange,
  options,
  required,
  disabled,
  placeholder,
  hint,
  inputClassName = "w-full border rounded px-3 py-2",
}) {
  const uid = useId();
  const listboxId = `${uid}-listbox`;
  const inputRef = useRef(null);
  const wrapRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const normalizedValue = useMemo(() => norm(value), [value]);
  const normalizedOptions = useMemo(() => uniqSorted([...(options || []), normalizedValue]), [options, normalizedValue]);

  const visibleOptions = useMemo(() => {
    if (!open) return [];
    const q = norm(value).toLowerCase();
    if (!q) return normalizedOptions;
    if (normalizedOptions.some((o) => o.toLowerCase() === q)) return normalizedOptions;
    return normalizedOptions.filter((o) => o.toLowerCase().includes(q));
  }, [open, value, normalizedOptions]);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  function pick(p) {
    onChange?.(p);
    setOpen(false);
    setActiveIndex(-1);
    window.setTimeout(() => inputRef.current?.blur?.(), 0);
  }

  return (
    <div ref={wrapRef}>
      {label ? (
        <label className="block text-sm font-medium mb-1">
          {label} {required ? <span className="text-red-600">*</span> : null}
        </label>
      ) : null}
      <div className="relative">
        <input
          ref={inputRef}
          className={inputClassName}
          disabled={disabled}
          required={required}
          placeholder={disabled ? placeholder : hint || placeholder}
          value={value || ""}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          onFocus={() => {
            if (disabled) return;
            setOpen(true);
            setActiveIndex(-1);
          }}
          onBlur={(e) => {
            window.setTimeout(() => {
              if (!e.currentTarget) return;
              setOpen(false);
              setActiveIndex(-1);
            }, 0);
          }}
          onChange={(e) => {
            if (!open) setOpen(true);
            setActiveIndex(-1);
            onChange?.(e.target.value);
          }}
          onKeyDown={(e) => {
            if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
              setOpen(true);
              return;
            }
            if (!open) return;

            if (e.key === "Escape") {
              e.preventDefault();
              setOpen(false);
              setActiveIndex(-1);
              return;
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIndex((i) => Math.min(i + 1, visibleOptions.length - 1));
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((i) => Math.max(i - 1, 0));
              return;
            }
            if (e.key === "Enter") {
              const pickVal = visibleOptions[activeIndex];
              if (!pickVal) return;
              e.preventDefault();
              pick(pickVal);
            }
          }}
        />

        {open && !disabled && visibleOptions.length > 0 ? (
          <ul
            id={listboxId}
            role="listbox"
            className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded border bg-white shadow"
          >
            {visibleOptions.map((o, idx) => {
              const active = idx === activeIndex;
              return (
                <li
                  key={o}
                  role="option"
                  aria-selected={active}
                  className={[
                    "cursor-pointer px-3 py-2 text-sm",
                    active ? "bg-gray-100" : "bg-white",
                  ].join(" ")}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onMouseDown={(ev) => {
                    ev.preventDefault();
                    pick(o);
                  }}
                >
                  {o}
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

export default function TownWardStationSelect({
  town,
  ward,
  station,
  onTownChange,
  onWardChange,
  onStationChange,
  requiredTown = false,
  requiredWard = false,
  requiredStation = false,
  disabled = false,
  items = [],
  user = null,
  inputClassName = "input",
  townInputClassName,
  wardInputClassName,
  stationInputClassName,
  showTown = true,
  showWard = true,
  showStation = true,
  townLabel = "Town/Village",
  wardLabel = "Ward/Street",
  stationLabel = "Nearest police station",
}) {
  const normalizedTown = norm(town);

  const townOptions = useMemo(() => {
    const fromItems = (items || []).map((it) => it?.village);
    const fromUser = user?.village;
    return uniqSorted([...(fromItems || []), fromUser, town]);
  }, [items, user?.village, town]);

  const wardOptions = useMemo(() => {
    const filtered = (items || []).filter((it) => {
      const v = norm(it?.village);
      return normalizedTown ? v.toLowerCase() === normalizedTown.toLowerCase() : true;
    });
    const fromItems = filtered.map((it) => it?.ward);
    const fromUser =
      normalizedTown &&
      norm(user?.village).toLowerCase() === normalizedTown.toLowerCase()
        ? user?.ward
        : null;
    return uniqSorted([...(fromItems || []), fromUser, ward]);
  }, [items, user?.village, user?.ward, normalizedTown, ward]);

  const stationOptions = useMemo(() => {
    const filtered = (items || []).filter((it) => {
      const v = norm(it?.village);
      return normalizedTown ? v.toLowerCase() === normalizedTown.toLowerCase() : true;
    });
    const fromItems = filtered.map((it) => it?.station || it?.location);
    const fromUser =
      normalizedTown &&
      norm(user?.village).toLowerCase() === normalizedTown.toLowerCase()
        ? user?.police_station
        : null;
    return uniqSorted([...(fromItems || []), fromUser, station]);
  }, [items, user?.village, user?.police_station, normalizedTown, station]);

  const hint = "Type to add a new entry";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {showTown ? (
        <ComboboxInput
          label={townLabel}
          value={town || ""}
          onChange={onTownChange}
          options={townOptions}
          required={requiredTown}
          disabled={disabled}
          placeholder="e.g. Gaborone"
          hint={hint}
          inputClassName={townInputClassName || inputClassName}
        />
      ) : null}

      {showWard ? (
        <ComboboxInput
          label={wardLabel}
          value={ward || ""}
          onChange={onWardChange}
          options={wardOptions}
          required={requiredWard}
          disabled={disabled || !norm(town)}
          placeholder={norm(town) ? "e.g. Ward 3" : "Pick a town/village first"}
          hint={norm(town) ? hint : undefined}
          inputClassName={wardInputClassName || inputClassName}
        />
      ) : null}

      {showStation ? (
        <div className={showTown && showWard ? "sm:col-span-2" : ""}>
          <ComboboxInput
            label={stationLabel}
            value={station || ""}
            onChange={onStationChange}
            options={stationOptions}
            required={requiredStation}
            disabled={disabled || !norm(town)}
            placeholder={norm(town) ? "Type or pick a station…" : "Pick a town/village first"}
            hint={norm(town) ? hint : undefined}
            inputClassName={stationInputClassName || inputClassName}
          />
        </div>
      ) : null}
    </div>
  );
}

