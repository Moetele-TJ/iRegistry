// src/hooks/useItemVerification.js
import { useState } from "react";
import { invokeFn } from "../lib/invokeFn";

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

      const res = await invokeFn(
        "verify-item",
        { body: { serial } },
        { withAuth: false }
      );

      const { data, error } = res || {};

      // If free limit is reached and user is logged in, retry authenticated (paid).
      if ((error?.context?.status === 402 || data?.billing?.required) && localStorage.getItem("session")) {
        const paid = await invokeFn("verify-item", { body: { serial } }, { withAuth: true });
        const { data: paidData, error: paidError } = paid || {};
        if (paidError || !paidData?.success) {
          throw new Error(paidData?.message || paidError?.message || "Verification failed");
        }
        setResult(paidData.result);
        return;
      }

      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || "Verification failed");
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