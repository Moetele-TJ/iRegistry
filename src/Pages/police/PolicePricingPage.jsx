import PricingPage from "../shared/PricingPage.jsx";
import { POLICE_TOPUP_PATH } from "../../lib/billingUx.js";

export default function PolicePricingPage() {
  return (
    <PricingPage
      title="Pricing"
      subtitle="Credits required for each task"
      topUpTo={POLICE_TOPUP_PATH}
    />
  );
}

