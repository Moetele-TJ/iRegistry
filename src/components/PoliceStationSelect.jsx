import { useCallback } from "react";
import { invokeFn } from "../lib/invokeFn.js";
import SearchableOptionsSelect from "./SearchableOptionsSelect.jsx";

export default function PoliceStationSelect({
  value,
  onChange,
  label = "Police station",
  required = false,
  disabled = false,
  placeholder = "Select a police station…",
  allowOther = true,
  variant = "select",
  inputClassName = "w-full border rounded-lg px-4 py-2",
  withAuth = true,
  helpText,
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
      emptyNoMatchMessage="No matching stations."
      typedValueLabel={(q) => `Use "${q}" as station name`}
    />
  );
}
