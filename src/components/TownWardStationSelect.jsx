import { useEffect, useId, useMemo, useRef, useState } from "react";
import { invokeWithAuth } from "../lib/invokeWithAuth.js";

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
  const normalizedTown = useMemo(() => norm(town), [town]);

  const [villages, setVillages] = useState([]);
  const [wards, setWards] = useState([]);
  const [stations, setStations] = useState([]);
  const [loadingVillages, setLoadingVillages] = useState(false);
  const [loadingWards, setLoadingWards] = useState(false);
  const [loadingStations, setLoadingStations] = useState(false);

  const villagesAbortRef = useRef(null);
  const wardsAbortRef = useRef(null);
  const stationsAbortRef = useRef(null);

  async function fetchLocationTaxonomy({ village, signal }) {
    const { data, error } = await invokeWithAuth("list-location-taxonomy", {
      body: { village: village || "", limit: 5000 },
      signal,
    });
    if (error) throw error;
    return {
      villages: Array.isArray(data?.villages) ? data.villages : [],
      wards: Array.isArray(data?.wards) ? data.wards : [],
      stations: Array.isArray(data?.stations) ? data.stations : [],
    };
  }

  // 1) Villages (independent list)
  useEffect(() => {
    villagesAbortRef.current?.abort?.();
    const ac = new AbortController();
    villagesAbortRef.current = ac;

    let alive = true;
    setLoadingVillages(true);

    fetchLocationTaxonomy({ village: "", signal: ac.signal })
      .then((t) => {
        if (!alive) return;
        setVillages(t.villages);
      })
      .catch(() => {
        // Fallback to local memory if API unavailable.
        const fromItems = (items || []).map((it) => it?.village);
        const fromUser = user?.village;
        if (!alive) return;
        setVillages(uniqSorted([...(fromItems || []), fromUser, town]));
      })
      .finally(() => {
        if (!alive) return;
        setLoadingVillages(false);
      });

    return () => {
      alive = false;
      ac.abort();
    };
  }, [items, user?.village, town]);

  // 2) Wards + stations (filtered by village)
  useEffect(() => {
    // If town is cleared, downstream lists should clear too.
    if (!normalizedTown) {
      setWards([]);
      setStations([]);
      return;
    }

    wardsAbortRef.current?.abort?.();
    stationsAbortRef.current?.abort?.();
    const wardsAc = new AbortController();
    const stationsAc = new AbortController();
    wardsAbortRef.current = wardsAc;
    stationsAbortRef.current = stationsAc;

    let alive = true;
    setLoadingWards(true);
    setLoadingStations(true);

    // Use one request for both wards + stations.
    fetchLocationTaxonomy({ village: normalizedTown, signal: wardsAc.signal })
      .then((t) => {
        if (!alive) return;
        setWards(t.wards);
        setStations(t.stations);
      })
      .catch(() => {
        // Fallback: filter local items by selected town.
        const filtered = (items || []).filter((it) => {
          const v = norm(it?.village);
          return v && v.toLowerCase() === normalizedTown.toLowerCase();
        });
        const fromWards = filtered.map((it) => it?.ward);
        const fromStations = filtered.map((it) => it?.station || it?.location);
        const fromUserWard =
          norm(user?.village).toLowerCase() === normalizedTown.toLowerCase()
            ? user?.ward
            : null;
        const fromUserStation =
          norm(user?.village).toLowerCase() === normalizedTown.toLowerCase()
            ? user?.police_station
            : null;
        if (!alive) return;
        setWards(uniqSorted([...(fromWards || []), fromUserWard, ward]));
        setStations(uniqSorted([...(fromStations || []), fromUserStation, station]));
      })
      .finally(() => {
        if (!alive) return;
        setLoadingWards(false);
        setLoadingStations(false);
      });

    return () => {
      alive = false;
      wardsAc.abort();
      stationsAc.abort();
    };
  }, [normalizedTown, items, user?.village, user?.ward, user?.police_station, ward, station]);

  const townOptions = useMemo(
    () => uniqSorted([...(villages || []), town]),
    [villages, town],
  );
  const wardOptions = useMemo(
    () => uniqSorted([...(wards || []), ward]),
    [wards, ward],
  );
  const stationOptions = useMemo(
    () => uniqSorted([...(stations || []), station]),
    [stations, station],
  );

  const locationLoading = loadingVillages || loadingWards || loadingStations;
  const hint = locationLoading ? "Loading options..." : "Type to add a new entry";

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

