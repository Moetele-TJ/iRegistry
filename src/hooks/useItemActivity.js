//src/hooks/useItemActivity.js
import { useEffect, useState } from "react";
import { invokeWithAuth } from "../lib/invokeWithAuth";

export function useItemActivity(itemId) {

  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {

    if (!itemId) {
      setActivity([]);
      return;
    }

    setActivity([]);

    async function loadActivity() {
      try {

        setLoading(true);

        const { data, error } = await invokeWithAuth(
          "get-item-activity",
          {
            body: { itemId }
          }
        );

        if (!error && data?.success) {
          setActivity(data.activity || []);
        }

      } catch (err) {
        console.error("Failed to load activity", err);
      } finally {
        setLoading(false);
      }
    }

    loadActivity();

  }, [itemId]);

  return { activity, loading };
}