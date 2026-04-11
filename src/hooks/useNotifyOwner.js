//  📁 src/hooks/useNotifyOwner.js
import { useState } from "react";
import { invokeFn } from "../lib/invokeFn";
import { attachBillingToError } from "../lib/billingUx.js";
import { useBillingErrorMessage } from "./useBillingErrorMessage.js";

export function useNotifyOwner() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const formatBilling = useBillingErrorMessage();

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
          const e = attachBillingToError(
            new Error(paidData?.message || paidError?.message || "Failed to notify owner"),
            paidData
          );
          setError(formatBilling(e));
          return;
        }
        setSuccess(true);
        return;
      }

      if (error || !data?.success) {
        const e = attachBillingToError(
          new Error(data?.message || error?.message || "Failed to notify owner"),
          data
        );
        setError(formatBilling(e));
        return;
      }

      setSuccess(true);
    } catch (err) {
      setError(formatBilling(err));
    } finally {
      setLoading(false);
    }
  }

  return { notify, loading, success, error };
}
