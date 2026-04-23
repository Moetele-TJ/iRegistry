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
  const catListId = `${uid}-cat-list`;
  const makeListId = `${uid}-make-list`;
  const modelListId = `${uid}-model-list`;

  const [cats, setCats] = useState([]);
  const [makes, setMakes] = useState([]);
  const [models, setModels] = useState([]);
  const [loadingCats, setLoadingCats] = useState(false);
  const [loadingMakes, setLoadingMakes] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);

  const catsAbortRef = useRef(null);
  const makesAbortRef = useRef(null);
  const modelsAbortRef = useRef(null);

  const normalizedCategory = useMemo(() => (category || "").trim(), [category]);
  const normalizedMake = useMemo(() => (make || "").trim(), [make]);

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
          <input
            className="w-full border rounded px-3 py-2"
            disabled={disabled}
            required={required}
            placeholder={hint}
            list={catListId}
            value={category || ""}
            onChange={(e) => {
              const next = e.target.value;
              const nextTrimmed = next.trim();

              // Keep downstream selections consistent when category changes.
              if (nextTrimmed !== normalizedCategory) {
                onMakeChange?.("");
                onModelChange?.("");
              }

              onCategoryChange?.(next);
            }}
          />
          <datalist id={catListId}>
            {cats.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
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

