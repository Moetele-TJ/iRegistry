import { Link } from "react-router-dom";
import { USER_PRICING_PATH, USER_TRANSACTIONS_PATH } from "../lib/billingUx";

/**
 * Inline links for topping up context (pricing table + payment history).
 */
export default function BillingHelpLinks({ className = "" }) {
  return (
    <p className={`text-sm text-gray-600 flex flex-wrap gap-x-3 gap-y-1 ${className}`}>
      <Link to={USER_PRICING_PATH} className="text-iregistrygreen font-medium hover:underline">
        Credit pricing
      </Link>
      <span className="text-gray-300">·</span>
      <Link to={USER_TRANSACTIONS_PATH} className="text-iregistrygreen font-medium hover:underline">
        Transactions
      </Link>
    </p>
  );
}
