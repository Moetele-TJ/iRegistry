import { useCallback, useEffect, useMemo, useState } from "react";
import { invokeFn } from "../lib/invokeFn.js";
import SearchableOptionsSelect, { normOption } from "./SearchableOptionsSelect.jsx";

function uniqSorted(values) {
  const set = new Set(values.map(normOption).filter(Boolean));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
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
  withAuth = true,
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
  const normalizedTown = useMemo(() => normOption(town), [town]);
  const [debouncedTown, setDebouncedTown] = useState(normalizedTown);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedTown(normalizedTown), 280);
    return () => window.clearTimeout(t);
  }, [normalizedTown]);

  const fetchTaxonomy = useCallback(
    async (village) => {
      const { data, error } = await invokeFn(
        "list-location-taxonomy",
        { body: { village: village || "", limit: 5000 } },
        { withAuth },
      );
      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.message || "Failed to load location options");
      }
      return data;
    },
    [withAuth],
  );

  const fallbackVillages = useCallback(() => {
    const fromItems = (items || []).map((it) => it?.village);
    const fromUser = user?.village;
    return uniqSorted([...(fromItems || []), fromUser, town]);
  }, [items, user?.village, town]);

  const fallbackWards = useCallback(() => {
    const townKey = debouncedTown.toLowerCase();
    if (!townKey) return uniqSorted([ward]);
    const filtered = (items || []).filter((it) => {
      const v = normOption(it?.village);
      return v && v.toLowerCase() === townKey;
    });
    const fromWards = filtered.map((it) => it?.ward);
    const fromUserWard =
      normOption(user?.village).toLowerCase() === townKey ? user?.ward : null;
    return uniqSorted([...(fromWards || []), fromUserWard, ward]);
  }, [debouncedTown, items, user?.village, user?.ward, ward]);

  const fallbackStations = useCallback(() => {
    const townKey = debouncedTown.toLowerCase();
    if (!townKey) return uniqSorted([station]);
    const filtered = (items || []).filter((it) => {
      const v = normOption(it?.village);
      return v && v.toLowerCase() === townKey;
    });
    const fromStations = filtered.map((it) => it?.station || it?.location);
    const fromUserStation =
      normOption(user?.village).toLowerCase() === townKey ? user?.police_station : null;
    return uniqSorted([...(fromStations || []), fromUserStation, station]);
  }, [debouncedTown, items, user?.village, user?.police_station, station]);

  const loadVillages = useCallback(async () => {
    try {
      const data = await fetchTaxonomy("");
      return Array.isArray(data.villages) ? data.villages : [];
    } catch {
      return fallbackVillages();
    }
  }, [fetchTaxonomy, fallbackVillages]);

  const loadWards = useCallback(async () => {
    if (!debouncedTown) return [];
    try {
      const data = await fetchTaxonomy(debouncedTown);
      return Array.isArray(data.wards) ? data.wards : [];
    } catch {
      return fallbackWards();
    }
  }, [debouncedTown, fetchTaxonomy, fallbackWards]);

  const loadStations = useCallback(async () => {
    if (!debouncedTown) return [];
    try {
      const data = await fetchTaxonomy(debouncedTown);
      return Array.isArray(data.stations) ? data.stations : [];
    } catch {
      return fallbackStations();
    }
  }, [debouncedTown, fetchTaxonomy, fallbackStations]);

  const townClass = townInputClassName || inputClassName;
  const wardClass = wardInputClassName || inputClassName;
  const stationClass = stationInputClassName || inputClassName;
  const wardDisabled = disabled || !normalizedTown;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {showTown ? (
        <SearchableOptionsSelect
          label={townLabel}
          value={town}
          onChange={onTownChange}
          required={requiredTown}
          disabled={disabled}
          variant="searchable"
          inputClassName={townClass}
          loadOptions={loadVillages}
          reloadKey={`villages-${withAuth}`}
          placeholder="Select or type your town / village"
          loadingPlaceholder="Loading towns…"
          retryLabel="Load towns list"
          listboxAriaLabel="Towns and villages"
          emptyNoMatchMessage="No matching towns."
          typedValueLabel={(q) => `Use "${q}" as town / village`}
          helpText="Pick from the list, search to narrow it, or type a name if yours is not listed."
        />
      ) : null}

      {showWard ? (
        <SearchableOptionsSelect
          label={wardLabel}
          value={ward}
          onChange={onWardChange}
          required={requiredWard}
          disabled={wardDisabled}
          variant="searchable"
          inputClassName={wardClass}
          loadOptions={loadWards}
          reloadKey={`wards-${debouncedTown}-${withAuth}`}
          placeholder={
            normalizedTown ? "Select or type your ward / street" : "Pick a town / village first"
          }
          loadingPlaceholder="Loading wards…"
          retryLabel="Load wards list"
          listboxAriaLabel="Wards and streets"
          emptyNoMatchMessage="No matching wards."
          typedValueLabel={(q) => `Use "${q}" as ward / street`}
          helpText={
            normalizedTown
              ? "Pick from the list, search to narrow it, or type a name if yours is not listed."
              : undefined
          }
        />
      ) : null}

      {showStation ? (
        <div className={showTown && showWard ? "sm:col-span-2" : ""}>
          <SearchableOptionsSelect
            label={stationLabel}
            value={station}
            onChange={onStationChange}
            required={requiredStation}
            disabled={wardDisabled}
            variant="searchable"
            inputClassName={stationClass}
            loadOptions={loadStations}
            reloadKey={`stations-${debouncedTown}-${withAuth}`}
            placeholder={
              normalizedTown ? "Select or type a station…" : "Pick a town / village first"
            }
            loadingPlaceholder="Loading stations…"
            retryLabel="Load stations list"
            listboxAriaLabel="Police stations for area"
            emptyNoMatchMessage="No matching stations."
            typedValueLabel={(q) => `Use "${q}" as station name`}
          />
        </div>
      ) : null}
    </div>
  );
}
