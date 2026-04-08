//  📁 src/hooks/useNotifyOwner.js
import { useState } from "react";
import { invokeFn } from "../lib/invokeFn";

export function useNotifyOwner() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  async function notify({ serial, message, contact, notifyPolice }) {
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);

      const res = await invokeFn(
        "notify-owner",
        { body: { serial, message, contact, notifyPolice } },
        { withAuth: false }
      );

      const { data, error } = res || {};

      // If free limit is reached and user is logged in, retry authenticated (paid).
      if ((error?.context?.status === 402 || data?.billing?.required) && localStorage.getItem("session")) {
        const paid = await invokeFn(
          "notify-owner",
          { body: { serial, message, contact, notifyPolice } },
          { withAuth: true }
        );
        const { data: paidData, error: paidError } = paid || {};
        if (paidError || !paidData?.success) {
          throw new Error(paidData?.message || "Failed to notify owner");
        }
        setSuccess(true);
        return;
      }

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