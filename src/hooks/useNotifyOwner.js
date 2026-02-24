//  📁 src/hooks/useNotifyOwner.js
import { useState } from "react";
import { supabase } from "../lib/supabase";

export function useNotifyOwner() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  async function notify({ serial, message, contact, notifyPolice }) {
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);

      const { data, error } =
        await supabase.functions.invoke("notify-owner", {
          body: { serial, message, contact, notifyPolice },
        });

      if (error || !data?.success) {
        throw new Error(data?.message || "Failed to notify owner");
      }

      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return { notify, loading, success, error };
}