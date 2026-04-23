import { useEffect, useId, useMemo, useRef, useState } from "react";

import { invokeWithAuth } from "../lib/invokeWithAuth";

async function fetchTaxonomy({ category, make, limit = 5000, signal }) {
  const { data, error } = await invokeWithAuth("list-item-taxonomy", {
    body: {
      category: category || "",
      make: make || "",
      limit,
    },
    signal,
  });
  if (error) throw error;
  return {
    categories: Array.isArray(data?.categories) ? data.categories : [],
    makes: Array.isArray(data?.makes) ? data.makes : [],
    models: Array.isArray(data?.models) ? data.models : [],
  };
}

export default function CategoryMakeModelSelect({
  category,
  make,
  model,
  onCategoryChange,
  onMakeChange,
  onModelChange,
  required = false,
  disabled = false,
  className = "",
  categoryLabel = "Category",
  makeLabel = "Make",
  modelLabel = "Model",
}) {
  const uid = useId();
  const catListboxId = `${uid}-cat-listbox`;
  const makeListId = `${uid}-make-list`;
  const modelListId = `${uid}-model-list`;

  const [cats, setCats] = useState([]);
  const [makes, setMakes] = useState([]);
  const [models, setModels] = useState([]);
  const [loadingCats, setLoadingCats] = useState(false);
  const [loadingMakes, setLoadingMakes] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [catsOpen, setCatsOpen] = useState(false);
  const [catsActiveIndex, setCatsActiveIndex] = useState(-1);

  const catsAbortRef = useRef(null);
  const makesAbortRef = useRef(null);
  const modelsAbortRef = useRef(null);
  const catsInputRef = useRef(null);

  const normalizedCategory = useMemo(() => (category || "").trim(), [category]);
  const normalizedMake = useMemo(() => (make || "").trim(), [make]);
  const categoryOptions = useMemo(() => {
    const set = new Set(cats);
    if (normalizedCategory) set.add(normalizedCategory);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [cats, normalizedCategory]);

  const visibleCategoryOptions = useMemo(() => {
    const raw = categoryOptions;
    const q = (category || "").trim().toLowerCase();

    // If the input exactly matches an existing option, show all options so the
    // user can easily switch categories (avoids the native <datalist> behavior).
    if (!catsOpen) return [];
    if (!q) return raw;
    if (raw.some((c) => c.toLowerCase() === q)) return raw;

    return raw.filter((c) => c.toLowerCase().includes(q));
  }, [categoryOptions, category, catsOpen]);

  useEffect(() => {
    catsAbortRef.current?.abort?.();
    const ac = new AbortController();
    catsAbortRef.current = ac;

    let alive = true;
    setLoadingCats(true);

    fetchTaxonomy({
      category: "",
      make: "",
      signal: ac.signal,
    })
      .then((t) => {
        if (!alive) return;
        setCats(t.categories);
      })
      .catch(() => {})
      .finally(() => {
        if (!alive) return;
        setLoadingCats(false);
      });

    return () => {
      alive = false;
      ac.abort();
    };
  }, []);

  useEffect(() => {
    // If category is cleared, downstream lists should clear too.
    if (!normalizedCategory) {
      setMakes([]);
      setModels([]);
      return;
    }

    makesAbortRef.current?.abort?.();
    const ac = new AbortController();
    makesAbortRef.current = ac;

    let alive = true;
    setLoadingMakes(true);

    fetchTaxonomy({
      category: normalizedCategory,
      make: "",
      signal: ac.signal,
    })
      .then((t) => {
        if (!alive) return;
        setMakes(t.makes);
        setModels([]); // models depend on make too
      })
      .catch(() => {})
      .finally(() => {
        if (!alive) return;
        setLoadingMakes(false);
      });

    return () => {
      alive = false;
      ac.abort();
    };
  }, [normalizedCategory]);

  useEffect(() => {
    if (!normalizedCategory || !normalizedMake) {
      setModels([]);
      return;
    }

    modelsAbortRef.current?.abort?.();
    const ac = new AbortController();
    modelsAbortRef.current = ac;

    let alive = true;
    setLoadingModels(true);

    fetchTaxonomy({
      category: normalizedCategory,
      make: normalizedMake,
      signal: ac.signal,
    })
      .then((t) => {
        if (!alive) return;
        setModels(t.models);
      })
      .catch(() => {})
      .finally(() => {
        if (!alive) return;
        setLoadingModels(false);
      });

    return () => {
      alive = false;
      ac.abort();
    };
  }, [normalizedCategory, normalizedMake]);

  const loading = loadingCats || loadingMakes || loadingModels;
  const hint = loading ? "Loading options..." : "Type to add a new entry";

  return (
    <div className={className}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">{categoryLabel}</label>
          <div className="relative">
            <input
              ref={catsInputRef}
              className="w-full border rounded px-3 py-2"
              disabled={disabled}
              required={required}
              placeholder={hint}
              value={category || ""}
              role="combobox"
              aria-expanded={catsOpen}
              aria-controls={catListboxId}
              aria-autocomplete="list"
              onFocus={() => {
                if (disabled) return;
                setCatsOpen(true);
                setCatsActiveIndex(-1);
              }}
              onBlur={(e) => {
                // Allow option click (mousedown) to run first.
                window.setTimeout(() => {
                  if (!e.currentTarget) return;
                  setCatsOpen(false);
                  setCatsActiveIndex(-1);
                }, 0);
              }}
              onChange={(e) => {
                const next = e.target.value;
                const nextTrimmed = next.trim();

                if (!catsOpen) setCatsOpen(true);
                setCatsActiveIndex(-1);

                // Keep downstream selections consistent when category changes.
                if (nextTrimmed !== normalizedCategory) {
                  onMakeChange?.("");
                  onModelChange?.("");
                }

                onCategoryChange?.(next);
              }}
              onKeyDown={(e) => {
                if (!catsOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
                  setCatsOpen(true);
                  return;
                }

                if (!catsOpen) return;

                if (e.key === "Escape") {
                  e.preventDefault();
                  setCatsOpen(false);
                  setCatsActiveIndex(-1);
                  return;
                }

                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setCatsActiveIndex((i) =>
                    Math.min(i + 1, visibleCategoryOptions.length - 1),
                  );
                  return;
                }

                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setCatsActiveIndex((i) => Math.max(i - 1, 0));
                  return;
                }

                if (e.key === "Enter") {
                  const pick = visibleCategoryOptions[catsActiveIndex];
                  if (!pick) return;

                  e.preventDefault();
                  if (pick.trim() !== normalizedCategory) {
                    onMakeChange?.("");
                    onModelChange?.("");
                  }
                  onCategoryChange?.(pick);
                  setCatsOpen(false);
                  setCatsActiveIndex(-1);
                  window.setTimeout(() => catsInputRef.current?.blur?.(), 0);
                }
              }}
            />

            {catsOpen && !disabled && visibleCategoryOptions.length > 0 && (
              <ul
                id={catListboxId}
                role="listbox"
                className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded border bg-white shadow"
              >
                {visibleCategoryOptions.map((c, idx) => {
                  const active = idx === catsActiveIndex;
                  return (
                    <li
                      key={c}
                      role="option"
                      aria-selected={active}
                      className={[
                        "cursor-pointer px-3 py-2 text-sm",
                        active ? "bg-gray-100" : "bg-white",
                      ].join(" ")}
                      onMouseEnter={() => setCatsActiveIndex(idx)}
                      onMouseDown={(e) => {
                        // Prevent blur before we set value.
                        e.preventDefault();

                        if (c.trim() !== normalizedCategory) {
                          onMakeChange?.("");
                          onModelChange?.("");
                        }
                        onCategoryChange?.(c);
                        setCatsOpen(false);
                        setCatsActiveIndex(-1);
                        window.setTimeout(() => catsInputRef.current?.blur?.(), 0);
                      }}
                    >
                      {c}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{makeLabel}</label>
          <input
            className="w-full border rounded px-3 py-2"
            disabled={disabled || !normalizedCategory}
            required={required}
            placeholder={normalizedCategory ? hint : "Pick a category first"}
            list={makeListId}
            value={make || ""}
            onChange={(e) => {
              const next = e.target.value;
              const nextTrimmed = next.trim();

              // Keep model consistent when make changes.
              if (nextTrimmed !== normalizedMake) {
                onModelChange?.("");
              }

              onMakeChange?.(next);
            }}
          />
          <datalist id={makeListId}>
            {makes.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{modelLabel}</label>
          <input
            className="w-full border rounded px-3 py-2"
            disabled={disabled || !normalizedCategory || !normalizedMake}
            required={required}
            placeholder={normalizedMake ? hint : "Pick a make first"}
            list={modelListId}
            value={model || ""}
            onChange={(e) => {
              const next = e.target.value;
              onModelChange?.(next);
            }}
          />
          <datalist id={modelListId}>
            {models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </div>
      </div>
    </div>
  );
}

