import { useCallback } from "react";
import { invokeFn } from "../lib/invokeFn.js";
import SearchableOptionsSelect from "./SearchableOptionsSelect.jsx";

export default function PoliceStationSelect({
  value,
  onChange,
  label = "Police station",
  required = false,
  disabled = false,
  placeholder = "Search or type a police station…",
  allowOther = true,
  variant = "searchable",
  inputClassName = "form-control",
  withAuth = true,
  helpText = "Pick from the list, or type a station name if yours is not listed.",
}) {
  const loadOptions = useCallback(async () => {
    const { data, error } = await invokeFn("list-police-stations", {}, { withAuth });
    if (error || !data?.success) {
      throw new Error(data?.message || error?.message || "Failed to load stations");
    }
    return Array.isArray(data.stations) ? data.stations : [];
  }, [withAuth]);

  return (
    <SearchableOptionsSelect
      value={value}
      onChange={onChange}
      label={label}
      required={required}
      disabled={disabled}
      placeholder={placeholder}
      allowOther={allowOther}
      variant={variant}
      inputClassName={inputClassName}
      helpText={helpText}
      loadOptions={loadOptions}
      reloadKey={withAuth}
      loadingPlaceholder="Loading stations…"
      retryLabel="Load stations list"
      listboxAriaLabel="Police stations"
      emptyNoMatchMessage="No matching stations. You can still use the name you typed."
      typedValueLabel={(q) => `Use "${q}" as station name`}
    />
  );
}
