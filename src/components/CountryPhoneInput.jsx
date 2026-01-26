import { useState, useMemo, useEffect, useRef } from "react";
import { countries } from "../data/countries";

const RECENT_KEY = "recent_countries";

// ----------------------------
// HIGHLIGHT MATCH
// ----------------------------
function highlightMatch(text, query) {
  if (!query) return text;

  const regex = new RegExp(`(${query})`, "ig");
  const parts = text.split(regex);

  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <span key={i} className="bg-yellow-200 rounded px-0.5">
        {part}
      </span>
    ) : (
      part
    )
  );
}

export default function CountryPhoneInput({
  country,
  phone,
  onChange,
  errorCountry,
  errorPhone,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);

  const wrapperRef = useRef(null);
  const listRef = useRef(null);

  const selectedCountry = countries.find((c) => c.code === country);

  // ----------------------------
  // RECENT COUNTRIES
  // ----------------------------
  const recentCountries = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(RECENT_KEY)) || [];
    } catch {
      return [];
    }
  }, []);

  function saveRecent(code) {
    const updated = [
      code,
      ...recentCountries.filter((c) => c !== code),
    ].slice(0, 5);

    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  }

  // ----------------------------
  // FILTERING
  // ----------------------------
  const filteredCountries = useMemo(() => {
    let list = countries;

    if (search) {
      list = list.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (!search && recentCountries.length > 0) {
      const recent = countries.filter((c) =>
        recentCountries.includes(c.code)
      );
      const rest = countries.filter(
        (c) => !recentCountries.includes(c.code)
      );
      return [...recent, ...rest];
    }

    return list;
  }, [search, recentCountries]);

  // ----------------------------
  // SELECT
  // ----------------------------
  function selectCountry(c) {
    saveRecent(c.code);
    setSearch("");
    setOpen(false);
    setHighlightIndex(0);

    onChange({
      country: c.code,
      phone: c.dialCode,
    });
  }

  // ----------------------------
  // KEYBOARD NAVIGATION
  // ----------------------------
  function handleKeyDown(e) {
    if (!open) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) =>
        Math.min(i + 1, filteredCountries.length - 1)
      );
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const c = filteredCountries[highlightIndex];
      if (c) selectCountry(c);
    }

    if (e.key === "Escape") {
      setOpen(false);
    }
  }

  // Auto-scroll highlighted item into view
  useEffect(() => {
    if (!listRef.current) return;

    const el = listRef.current.children[highlightIndex];
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [highlightIndex]);

  // ----------------------------
  // PHONE
  // ----------------------------
  function handlePhoneChange(value) {
    if (!selectedCountry) return;

    const digits = value.replace(/[^\d]/g, "");
    onChange({
      country,
      phone: selectedCountry.dialCode + digits,
    });
  }

  // ----------------------------
  // CLICK OUTSIDE
  // ----------------------------
  useEffect(() => {
    function close(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={wrapperRef} onKeyDown={handleKeyDown}>
      {/* COUNTRY */}
      <div className="mb-4 relative">
        <label className="block text-sm mb-1">
          Country <span className="text-red-600">*</span>
        </label>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`w-full flex items-center justify-between border rounded-lg px-4 py-3 text-base ${
            errorCountry ? "border-red-500" : ""
          }`}
        >
          {selectedCountry ? (
            <div className="flex items-center gap-3">
              <img
                src={selectedCountry.flag}
                alt={selectedCountry.name}
                className="w-6 h-4 rounded-sm object-cover"
              />
              <span>{selectedCountry.name}</span>
            </div>
          ) : (
            <span className="text-gray-400">Select country</span>
          )}
          <span className="text-gray-400">▾</span>
        </button>

        {open && (
          <div className="absolute z-50 mt-1 w-full bg-white border rounded-xl shadow-lg">
            {/* SEARCH */}
            <div className="sticky top-0 bg-white p-2 border-b z-10">
              <input
                autoFocus
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setHighlightIndex(0);
                }}
                placeholder="Type country name"
                className="w-full border rounded-lg px-3 py-3 text-base"
              />
            </div>

            {/* LIST */}
            <div
              ref={listRef}
              className="max-h-[55vh] overflow-y-auto"
            >
              {filteredCountries.length === 0 && (
                <div className="px-4 py-4 text-sm text-gray-500">
                  No countries found
                </div>
              )}

              {filteredCountries.map((c, i) => (
                <div
                  key={c.code}
                  onClick={() => selectCountry(c)}
                  className={`flex items-center gap-4 px-4 py-4 cursor-pointer ${
                    i === highlightIndex
                      ? "bg-iregistrygreen/10"
                      : "hover:bg-gray-100"
                  }`}
                >
                  <img
                    src={c.flag}
                    alt={c.name}
                    className="w-6 h-4 rounded-sm object-cover"
                  />
                  <span className="text-base">
                    {highlightMatch(c.name, search)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {errorCountry && (
          <p className="text-xs text-red-600 mt-1">{errorCountry}</p>
        )}
      </div>

      {/* PHONE */}
      <div className="mb-4">
        <label className="block text-sm mb-1">
          Phone number <span className="text-red-600">*</span>
        </label>

        <div
          className={`flex items-center border rounded-lg px-4 py-3 gap-3 ${
            errorPhone ? "border-red-500" : ""
          } ${!selectedCountry ? "bg-gray-100" : ""}`}
        >
          {selectedCountry && (
            <>
              <img
                src={selectedCountry.flag}
                alt={selectedCountry.name}
                className="w-6 h-4 rounded-sm object-cover"
              />
              <span className="text-base text-gray-600">
                {selectedCountry.dialCode}
              </span>
            </>
          )}

          <input
            disabled={!selectedCountry}
            inputMode="numeric"
            value={
              selectedCountry
                ? phone.replace(selectedCountry.dialCode, "")
                : ""
            }
            onChange={(e) => handlePhoneChange(e.target.value)}
            placeholder={
              selectedCountry
                ? "Enter phone number"
                : "Select country first"
            }
            className="flex-1 outline-none bg-transparent text-base"
          />
        </div>

        {errorPhone && (
          <p className="text-xs text-red-600 mt-1">{errorPhone}</p>
        )}
      </div>
    </div>
  );
}