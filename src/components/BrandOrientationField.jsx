/**
 * Visual brand layout picker + character boxes.
 * Choose orientation first; character inputs appear in that arrangement.
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

function CharacterGrid({ layout, characters, onCharactersChange }) {
  const def = layoutDef(layout);
  const n = charCountForLayout(layout);
  const display = String(characters || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .padEnd(n, "")
    .slice(0, n)
    .split("");
  while (display.length < n) display.push("");

  function handleChange(index, raw) {
    const ch = String(raw || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(-1);
    const next = [...display];
    next[index] = ch;
    let end = n;
    while (end > 0 && !next[end - 1]) end -= 1;
    onCharactersChange(next.slice(0, end).join(""));
  }

  return (
    <div className="flex flex-col items-center gap-1.5 py-1">
      {def.rows.map((row, ri) => (
        <div key={ri} className="flex items-center justify-center gap-1.5">
          {row.map((idx) => (
            <input
              key={idx}
              type="text"
              inputMode="text"
              maxLength={1}
              aria-label={`Brand character ${idx + 1}`}
              value={display[idx] || ""}
              onChange={(e) => handleChange(idx, e.target.value)}
              className="w-10 h-10 text-center text-base font-semibold uppercase tracking-wide border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-iregistrygreen/40 focus:border-iregistrygreen"
            />
          ))}
        </div>
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
 * }} props
 */
export default function BrandOrientationField({
  layout,
  characters,
  onLayoutChange,
  onCharactersChange,
}) {
  const isFour = layout === "square";
  const options = isFour ? [LAYOUT_SQUARE] : LAYOUTS_3;

  return (
    <div className="col-span-2 space-y-3">
      <div>
        <div className="text-xs font-medium text-gray-600 mb-1.5">Characters</div>
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
      </div>

      <div>
        <div className="text-xs font-medium text-gray-600 mb-1.5">Orientation</div>
        <div
          className={`grid gap-2 ${
            isFour ? "grid-cols-1 max-w-[8rem]" : "grid-cols-2 sm:grid-cols-4"
          }`}
        >
          {options.map((opt) => {
            const active = layout === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                title={opt.label}
                onClick={() => onLayoutChange(opt.value)}
                className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-2.5 transition-colors ${
                  active
                    ? "border-iregistrygreen bg-emerald-50/80 ring-1 ring-iregistrygreen/30"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <MiniBoxes rows={opt.rows} active={active} />
                <span className="text-[10px] leading-tight text-gray-600 text-center">
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {layout ? (
        <div>
          <div className="text-xs font-medium text-gray-600 mb-1">Brand mark</div>
          <div className="rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-3">
            <CharacterGrid
              layout={layout}
              characters={characters}
              onCharactersChange={onCharactersChange}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
