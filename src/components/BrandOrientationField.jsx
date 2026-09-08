import { useRef } from "react";

/**
 * Visual brand layout picker + character boxes.
 * Saved mark preview (orientation) on the left; horizontal entry boxes on the right.
 * Extra characters grow the entry row sideways.
 */

const LAYOUTS_3 = [
  {
    value: "horizontal",
    label: "Horizontal",
    rows: [[0, 1, 2]],
  },
  {
    value: "vertical",
    label: "Vertical",
    rows: [[0], [1], [2]],
  },
  {
    value: "two_up_one_down",
    label: "Two up, one below",
    rows: [[0, 1], [2]],
  },
  {
    value: "one_up_two_down",
    label: "One up, two below",
    rows: [[0], [1, 2]],
  },
];

const LAYOUT_SQUARE = {
  value: "square",
  label: "Square",
  rows: [
    [0, 1],
    [2, 3],
  ],
};

function charCountForLayout(layout) {
  return layout === "square" ? 4 : 3;
}

function layoutDef(layout) {
  if (layout === "square") return LAYOUT_SQUARE;
  return LAYOUTS_3.find((l) => l.value === layout) || LAYOUTS_3[0];
}

function normalizeChars(characters, n) {
  const display = String(characters || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .padEnd(n, "")
    .slice(0, n)
    .split("");
  while (display.length < n) display.push("");
  return display;
}

function MiniBoxes({ rows, active = false }) {
  return (
    <div className="flex flex-col items-center gap-0.5" aria-hidden>
      {rows.map((row, ri) => (
        <div key={ri} className="flex items-center justify-center gap-0.5">
          {row.map((idx) => (
            <span
              key={idx}
              className={`w-3 h-3 rounded-sm border ${
                active
                  ? "border-iregistrygreen bg-emerald-50"
                  : "border-gray-300 bg-white"
              }`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Read-only brand mark in its saved orientation. */
export function BrandMarkPreview({ layout, characters, side, body_part, className = "" }) {
  const def = layoutDef(layout || "horizontal");
  const n = charCountForLayout(layout || "horizontal");
  const display = normalizeChars(characters, n);
  const meta = [side, body_part].filter(Boolean).join(" · ");

  return (
    <div
      className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5 min-w-[5.5rem] ${className}`}
    >
      <div className="flex flex-col items-center gap-1">
        {def.rows.map((row, ri) => (
          <div key={ri} className="flex items-center justify-center gap-1">
            {row.map((idx) => (
              <span
                key={idx}
                className="w-8 h-8 inline-flex items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-sm font-semibold uppercase text-gray-900"
              >
                {display[idx] || "·"}
              </span>
            ))}
          </div>
        ))}
      </div>
      {meta ? <div className="text-[10px] text-gray-500 text-center leading-tight">{meta}</div> : null}
    </div>
  );
}

/** Always a single horizontal row — grows sideways for 3 vs 4 chars. */
function CharacterEntryRow({ layout, characters, onCharactersChange }) {
  const inputRefs = useRef([]);
  const n = charCountForLayout(layout);
  const display = normalizeChars(characters, n);

  function commit(nextChars) {
    const next = [...nextChars];
    while (next.length < n) next.push("");
    let end = n;
    while (end > 0 && !next[end - 1]) end -= 1;
    onCharactersChange(next.slice(0, end).join(""));
  }

  function focusAt(index) {
    const el = inputRefs.current[index];
    if (!el) return;
    el.focus();
    el.select?.();
  }

  function handleChange(index, raw) {
    const ch = String(raw || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(-1);
    if (!ch) return;
    const next = [...display];
    next[index] = ch;
    commit(next);
    if (index < n - 1) focusAt(index + 1);
  }

  function handleKeyDown(index, e) {
    if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      const next = [...display];
      if (next[index]) {
        next[index] = "";
        commit(next);
        if (index > 0) focusAt(index - 1);
      } else if (index > 0) {
        next[index - 1] = "";
        commit(next);
        focusAt(index - 1);
      }
      return;
    }
    if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      focusAt(index - 1);
      return;
    }
    if (e.key === "ArrowRight" && index < n - 1) {
      e.preventDefault();
      focusAt(index + 1);
    }
  }

  return (
    <div className="flex items-center justify-center gap-1.5">
      {Array.from({ length: n }, (_, idx) => (
        <input
          key={idx}
          ref={(el) => {
            inputRefs.current[idx] = el;
          }}
          type="text"
          inputMode="text"
          maxLength={1}
          autoComplete="off"
          aria-label={`Brand character ${idx + 1}`}
          value={display[idx] || ""}
          onChange={(e) => handleChange(idx, e.target.value)}
          onKeyDown={(e) => handleKeyDown(idx, e)}
          className="w-10 h-10 text-center text-base font-semibold uppercase tracking-wide border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-iregistrygreen/40 focus:border-iregistrygreen"
        />
      ))}
    </div>
  );
}

/**
 * @param {{
 *   layout: string,
 *   characters: string,
 *   onLayoutChange: (layout: string) => void,
 *   onCharactersChange: (characters: string) => void,
 *   side?: string,
 *   bodyPart?: string,
 *   onSideChange?: (side: string) => void,
 *   onBodyPartChange?: (bodyPart: string) => void,
 * }} props
 */
export default function BrandOrientationField({
  layout,
  characters,
  onLayoutChange,
  onCharactersChange,
  side,
  bodyPart,
  onSideChange,
  onBodyPartChange,
}) {
  const isFour = layout === "square";
  const options = isFour ? [LAYOUT_SQUARE] : LAYOUTS_3;
  const showPlacement = typeof onSideChange === "function" && typeof onBodyPartChange === "function";

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div className="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50 gap-0.5">
        <button
          type="button"
          className={`px-3 py-1.5 text-xs font-semibold rounded-md ${
            !isFour ? "bg-white text-iregistrygreen shadow-sm" : "text-gray-600"
          }`}
          onClick={() => {
            if (isFour) {
              onLayoutChange("horizontal");
              onCharactersChange(String(characters || "").slice(0, 3));
            }
          }}
        >
          3
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 text-xs font-semibold rounded-md ${
            isFour ? "bg-white text-iregistrygreen shadow-sm" : "text-gray-600"
          }`}
          onClick={() => {
            if (!isFour) {
              onLayoutChange("square");
              onCharactersChange(String(characters || "").slice(0, 4));
            }
          }}
        >
          4
        </button>
      </div>

      <div
        className={`grid gap-1.5 ${isFour ? "grid-cols-1 max-w-[6rem]" : "grid-cols-2 sm:grid-cols-4"}`}
      >
        {options.map((opt) => {
          const active = layout === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              title={opt.label}
              onClick={() => onLayoutChange(opt.value)}
              className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2 transition-colors ${
                active
                  ? "border-iregistrygreen bg-emerald-50/80 ring-1 ring-iregistrygreen/30"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <MiniBoxes rows={opt.rows} active={active} />
              <span className="text-[9px] leading-tight text-gray-600 text-center">
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Saved layout preview (left) + horizontal entry (right), centered as a pair */}
      {layout ? (
        <div className="flex flex-row flex-wrap items-center justify-center gap-4 sm:gap-6 w-full">
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
              Saved
            </div>
            <BrandMarkPreview layout={layout} characters={characters} />
          </div>

          <div className="flex flex-col items-center gap-2 shrink-0">
            <div className="text-[10px] font-medium uppercase tracking-wide text-gray-500">
              Enter
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50/80 px-4 py-3">
              <CharacterEntryRow
                layout={layout}
                characters={characters}
                onCharactersChange={onCharactersChange}
              />
            </div>
            {showPlacement ? (
              <div className="flex items-center justify-center gap-2">
                <select
                  className="border rounded-lg px-2 py-1.5 text-sm bg-white"
                  value={side || "left"}
                  onChange={(e) => onSideChange(e.target.value)}
                >
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </select>
                <select
                  className="border rounded-lg px-2 py-1.5 text-sm bg-white"
                  value={bodyPart || "shoulder"}
                  onChange={(e) => onBodyPartChange(e.target.value)}
                >
                  <option value="shoulder">Shoulder</option>
                  <option value="thigh">Thigh</option>
                  <option value="flank">Flank</option>
                  <option value="neck">Neck</option>
                </select>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
