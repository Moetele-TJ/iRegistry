import PricingPage from "../shared/PricingPage.jsx";
import { USER_TOPUP_PATH } from "../../lib/billingUx.js";

export default function UserPricingPage() {
  return (
    <PricingPage
      title="Pricing"
      subtitle="Credits required for each task"
      topUpTo={USER_TOPUP_PATH}
    />
  );
}

