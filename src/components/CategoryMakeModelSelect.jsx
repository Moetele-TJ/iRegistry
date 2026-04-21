import { useEffect, useId, useMemo, useRef, useState } from "react";

import { invokeWithAuth } from "../lib/invokeWithAuth";

async function fetchTaxonomy({ category, make, limit = 5000, signal }) {
  const res = await invokeWithAuth("list-item-taxonomy", {
    body: { category: category || "", make: make || "", limit },
    signal,
  });
  return {
    categories: Array.isArray(res?.categories) ? res.categories : [],
    makes: Array.isArray(res?.makes) ? res.makes : [],
    models: Array.isArray(res?.models) ? res.models : [],
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
  const [loading, setLoading] = useState(false);

  const abortRef = useRef(null);

  const normalizedCategory = useMemo(() => (category || "").trim(), [category]);
  const normalizedMake = useMemo(() => (make || "").trim(), [make]);

  useEffect(() => {
    abortRef.current?.abort?.();
    const ac = new AbortController();
    abortRef.current = ac;

    let alive = true;
    setLoading(true);

    fetchTaxonomy({ category: "", make: "", signal: ac.signal })
      .then((t) => {
        if (!alive) return;
        setCats(t.categories);
      })
      .catch(() => {})
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
      ac.abort();
    };
  }, []);

  useEffect(() => {
    abortRef.current?.abort?.();
    const ac = new AbortController();
    abortRef.current = ac;

    let alive = true;
    setLoading(true);

    fetchTaxonomy({ category: normalizedCategory, make: "", signal: ac.signal })
      .then((t) => {
        if (!alive) return;
        setMakes(t.makes);
        setModels([]); // models depend on make too
      })
      .catch(() => {})
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
      ac.abort();
    };
  }, [normalizedCategory]);

  useEffect(() => {
    abortRef.current?.abort?.();
    const ac = new AbortController();
    abortRef.current = ac;

    let alive = true;
    setLoading(true);

    fetchTaxonomy({ category: normalizedCategory, make: normalizedMake, signal: ac.signal })
      .then((t) => {
        if (!alive) return;
        setModels(t.models);
      })
      .catch(() => {})
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
      ac.abort();
    };
  }, [normalizedCategory, normalizedMake]);

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

