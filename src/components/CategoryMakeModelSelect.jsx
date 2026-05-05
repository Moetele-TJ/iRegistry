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
  const wrapRef = useRef(null);
  const uid = useId();
  const catListboxId = `${uid}-cat-listbox`;
  const makeListboxId = `${uid}-make-listbox`;
  const modelListboxId = `${uid}-model-listbox`;

  const [cats, setCats] = useState([]);
  const [makes, setMakes] = useState([]);
  const [models, setModels] = useState([]);
  const [loadingCats, setLoadingCats] = useState(false);
  const [loadingMakes, setLoadingMakes] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [catsOpen, setCatsOpen] = useState(false);
  const [catsActiveIndex, setCatsActiveIndex] = useState(-1);
  const [makesOpen, setMakesOpen] = useState(false);
  const [makesActiveIndex, setMakesActiveIndex] = useState(-1);
  const [modelsOpen, setModelsOpen] = useState(false);
  const [modelsActiveIndex, setModelsActiveIndex] = useState(-1);

  const catsAbortRef = useRef(null);
  const makesAbortRef = useRef(null);
  const modelsAbortRef = useRef(null);
  const catsInputRef = useRef(null);
  const makesInputRef = useRef(null);
  const modelsInputRef = useRef(null);

  const anyOpen = catsOpen || makesOpen || modelsOpen;
  useEffect(() => {
    if (!anyOpen) return;
    function onDocMouseDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setCatsOpen(false);
        setCatsActiveIndex(-1);
        setMakesOpen(false);
        setMakesActiveIndex(-1);
        setModelsOpen(false);
        setModelsActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [anyOpen]);

  const normalizedCategory = useMemo(() => (category || "").trim(), [category]);
  const normalizedMake = useMemo(() => (make || "").trim(), [make]);
  const normalizedModel = useMemo(() => (model || "").trim(), [model]);
  const categoryOptions = useMemo(() => {
    const set = new Set(cats);
    if (normalizedCategory) set.add(normalizedCategory);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [cats, normalizedCategory]);

  const visibleCategoryOptions = useMemo(() => {
    const raw = categoryOptions;
    const q = (category || "").trim().toLowerCase();

    if (!catsOpen) return [];
    if (!q) return raw;
    return raw.filter((c) => c.toLowerCase().includes(q));
  }, [categoryOptions, category, catsOpen]);

  const makeOptions = useMemo(() => {
    const set = new Set(makes);
    if (normalizedMake) set.add(normalizedMake);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [makes, normalizedMake]);

  const visibleMakeOptions = useMemo(() => {
    const raw = makeOptions;
    const q = (make || "").trim().toLowerCase();
    if (!makesOpen) return [];
    if (!q) return raw;
    return raw.filter((m) => m.toLowerCase().includes(q));
  }, [makeOptions, make, makesOpen]);

  const modelOptions = useMemo(() => {
    const set = new Set(models);
    if (normalizedModel) set.add(normalizedModel);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [models, normalizedModel]);

  const visibleModelOptions = useMemo(() => {
    const raw = modelOptions;
    const q = (model || "").trim().toLowerCase();
    if (!modelsOpen) return [];
    if (!q) return raw;
    return raw.filter((m) => m.toLowerCase().includes(q));
  }, [modelOptions, model, modelsOpen]);

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
    <div ref={wrapRef} className={className}>
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
          <div className="relative">
            <input
              ref={makesInputRef}
              className="w-full border rounded px-3 py-2"
              disabled={disabled || !normalizedCategory}
              required={required}
              placeholder={normalizedCategory ? hint : "Pick a category first"}
              value={make || ""}
              role="combobox"
              aria-expanded={makesOpen}
              aria-controls={makeListboxId}
              aria-autocomplete="list"
              onFocus={() => {
                if (disabled || !normalizedCategory) return;
                setMakesOpen(true);
                setMakesActiveIndex(-1);
              }}
              onBlur={(e) => {
                window.setTimeout(() => {
                  if (!e.currentTarget) return;
                  setMakesOpen(false);
                  setMakesActiveIndex(-1);
                }, 0);
              }}
              onChange={(e) => {
                const next = e.target.value;
                const nextTrimmed = next.trim();

                if (!makesOpen) setMakesOpen(true);
                setMakesActiveIndex(-1);

                // Keep model consistent when make changes.
                if (nextTrimmed !== normalizedMake) {
                  onModelChange?.("");
                }

                onMakeChange?.(next);
              }}
              onKeyDown={(e) => {
                if (!makesOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
                  setMakesOpen(true);
                  return;
                }
                if (!makesOpen) return;

                if (e.key === "Escape") {
                  e.preventDefault();
                  setMakesOpen(false);
                  setMakesActiveIndex(-1);
                  return;
                }
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setMakesActiveIndex((i) =>
                    Math.min(i + 1, visibleMakeOptions.length - 1),
                  );
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setMakesActiveIndex((i) => Math.max(i - 1, 0));
                  return;
                }
                if (e.key === "Enter") {
                  const pick = visibleMakeOptions[makesActiveIndex];
                  if (!pick) return;
                  e.preventDefault();
                  if (pick.trim() !== normalizedMake) {
                    onModelChange?.("");
                  }
                  onMakeChange?.(pick);
                  setMakesOpen(false);
                  setMakesActiveIndex(-1);
                  window.setTimeout(() => makesInputRef.current?.blur?.(), 0);
                }
              }}
            />

            {makesOpen && !(disabled || !normalizedCategory) && visibleMakeOptions.length > 0 && (
              <ul
                id={makeListboxId}
                role="listbox"
                className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded border bg-white shadow"
              >
                {visibleMakeOptions.map((m, idx) => {
                  const active = idx === makesActiveIndex;
                  return (
                    <li
                      key={m}
                      role="option"
                      aria-selected={active}
                      className={[
                        "cursor-pointer px-3 py-2 text-sm",
                        active ? "bg-gray-100" : "bg-white",
                      ].join(" ")}
                      onMouseEnter={() => setMakesActiveIndex(idx)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        if (m.trim() !== normalizedMake) {
                          onModelChange?.("");
                        }
                        onMakeChange?.(m);
                        setMakesOpen(false);
                        setMakesActiveIndex(-1);
                        window.setTimeout(() => makesInputRef.current?.blur?.(), 0);
                      }}
                    >
                      {m}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">{modelLabel}</label>
          <div className="relative">
            <input
              ref={modelsInputRef}
              className="w-full border rounded px-3 py-2"
              disabled={disabled || !normalizedCategory || !normalizedMake}
              required={required}
              placeholder={normalizedMake ? hint : "Pick a make first"}
              value={model || ""}
              role="combobox"
              aria-expanded={modelsOpen}
              aria-controls={modelListboxId}
              aria-autocomplete="list"
              onFocus={() => {
                if (disabled || !normalizedCategory || !normalizedMake) return;
                setModelsOpen(true);
                setModelsActiveIndex(-1);
              }}
              onBlur={(e) => {
                window.setTimeout(() => {
                  if (!e.currentTarget) return;
                  setModelsOpen(false);
                  setModelsActiveIndex(-1);
                }, 0);
              }}
              onChange={(e) => {
                const next = e.target.value;
                if (!modelsOpen) setModelsOpen(true);
                setModelsActiveIndex(-1);
                onModelChange?.(next);
              }}
              onKeyDown={(e) => {
                if (!modelsOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
                  setModelsOpen(true);
                  return;
                }
                if (!modelsOpen) return;

                if (e.key === "Escape") {
                  e.preventDefault();
                  setModelsOpen(false);
                  setModelsActiveIndex(-1);
                  return;
                }
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setModelsActiveIndex((i) =>
                    Math.min(i + 1, visibleModelOptions.length - 1),
                  );
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setModelsActiveIndex((i) => Math.max(i - 1, 0));
                  return;
                }
                if (e.key === "Enter") {
                  const pick = visibleModelOptions[modelsActiveIndex];
                  if (!pick) return;
                  e.preventDefault();
                  onModelChange?.(pick);
                  setModelsOpen(false);
                  setModelsActiveIndex(-1);
                  window.setTimeout(() => modelsInputRef.current?.blur?.(), 0);
                }
              }}
            />

            {modelsOpen && !(disabled || !normalizedCategory || !normalizedMake) && visibleModelOptions.length > 0 && (
              <ul
                id={modelListboxId}
                role="listbox"
                className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded border bg-white shadow"
              >
                {visibleModelOptions.map((m, idx) => {
                  const active = idx === modelsActiveIndex;
                  return (
                    <li
                      key={m}
                      role="option"
                      aria-selected={active}
                      className={[
                        "cursor-pointer px-3 py-2 text-sm",
                        active ? "bg-gray-100" : "bg-white",
                      ].join(" ")}
                      onMouseEnter={() => setModelsActiveIndex(idx)}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        onModelChange?.(m);
                        setModelsOpen(false);
                        setModelsActiveIndex(-1);
                        window.setTimeout(() => modelsInputRef.current?.blur?.(), 0);
                      }}
                    >
                      {m}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

