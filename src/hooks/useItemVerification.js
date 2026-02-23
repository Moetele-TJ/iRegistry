// src/hooks/useItemVerification.js
import { useState } from "react";
import { supabase } from "../lib/supabase";

export function useItemVerification() {
  const [result, setResult] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState(null);

  async function verify(serial) {
    if (!serial || !serial.trim()) return;

    try {
      setVerifying(true);
      setError(null);
      setResult(null);

      const { data, error } =
        await supabase.functions.invoke("verify-item", {
          body: { serial },
        });

      if (error || !data?.success) {
        throw new Error("Verification failed");
      }

      setResult(data.result);

    } catch (err) {
      setError(err.message);
    } finally {
      setVerifying(false);
    }
  }

  function reset() {
    setResult(null);
    setError(null);
  }

  return {
    result,
    verifying,
    error,
    verify,
    reset,
  };
}