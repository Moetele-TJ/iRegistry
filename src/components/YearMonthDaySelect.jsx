import { useEffect, useMemo, useState } from "react";
import {
  buildYmd,
  clampYmdParts,
  dayOptions,
  monthOptions,
  parseYmd,
  yearOptions,
} from "../lib/yearMonthDay.js";

/**
 * Date picker: year → month → day, combined as YYYY-MM-DD for forms/APIs.
 */
export default function YearMonthDaySelect({
  label,
  value = "",
  onChange,
  required = false,
  error = false,
  disabled = false,
  minYear,
  maxYear,
  minYmd,
  maxYmd,
  selectClassName = "form-control",
  labelClassName = "block text-sm mb-1",
  showHint = true,
}) {
  const now = new Date().getFullYear();
  const yMin = minYear ?? now - 100;
  const yMax = maxYear ?? now;

  const parsed = useMemo(() => parseYmd(value), [value]);
  const [year, setYear] = useState(parsed.year);
  const [month, setMonth] = useState(parsed.month);
  const [day, setDay] = useState(parsed.day);

  useEffect(() => {
    setYear(parsed.year);
    setMonth(parsed.month);
    setDay(parsed.day);
  }, [parsed.year, parsed.month, parsed.day]);

  const years = useMemo(() => yearOptions(yMin, yMax), [yMin, yMax]);
  const months = useMemo(() => monthOptions(), []);
  const days = useMemo(() => dayOptions(year, month), [year, month]);

  function emit(y, m, d) {
    const clamped = clampYmdParts(y, m, d, minYmd, maxYmd);
    const next = buildYmd(clamped.year, clamped.month, clamped.day);
    onChange?.(next);
  }

  function onYearChange(e) {
    const y = e.target.value;
    let m = month;
    let d = day;
    if (y && m && d) {
      const maxD = dayOptions(y, m).length;
      if (Number(d) > maxD) d = String(maxD);
    }
    setYear(y);
    if (!y) {
      setMonth("");
      setDay("");
      onChange?.("");
      return;
    }
    setDay(d);
    emit(y, m, d);
  }

  function onMonthChange(e) {
    const m = e.target.value;
    let d = day;
    if (year && m && d) {
      const maxD = dayOptions(year, m).length;
      if (Number(d) > maxD) d = String(maxD);
    }
    setMonth(m);
    if (!m) {
      setDay("");
      emit(year, "", "");
      return;
    }
    setDay(d);
    emit(year, m, d);
  }

  function onDayChange(e) {
    const d = e.target.value;
    setDay(d);
    emit(year, month, d);
  }

  const border = error ? "border-red-500" : "border-gray-200";
  const disabledCls = disabled ? "opacity-60 cursor-not-allowed bg-gray-50" : "";

  return (
    <div className="form-field min-w-0">
      {label ? (
        <label className={labelClassName}>
          {label} {required ? <span className="text-red-600">*</span> : null}
        </label>
      ) : null}
      <div className="grid grid-cols-3 gap-2">
        <div className="min-w-0">
          <span className="sr-only">Year</span>
          <select
            value={year}
            onChange={onYearChange}
            disabled={disabled}
            aria-label={label ? `${label} year` : "Year"}
            className={`${selectClassName} ${border} ${disabledCls}`}
          >
            <option value="">Year</option>
            {years.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0">
          <span className="sr-only">Month</span>
          <select
            value={month}
            onChange={onMonthChange}
            disabled={disabled || !year}
            aria-label={label ? `${label} month` : "Month"}
            className={`${selectClassName} ${border} ${disabledCls}`}
          >
            <option value="">Month</option>
            {months.map((m) => (
              <option key={m.value} value={String(m.value)}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0">
          <span className="sr-only">Day</span>
          <select
            value={day}
            onChange={onDayChange}
            disabled={disabled || !year || !month}
            aria-label={label ? `${label} day` : "Day"}
            className={`${selectClassName} ${border} ${disabledCls}`}
          >
            <option value="">Day</option>
            {days.map((d) => (
              <option key={d} value={String(d)}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>
      {showHint ? (
        <p className="text-xs text-gray-500 mt-1">Choose year, then month, then day.</p>
      ) : null}
    </div>
  );
}
