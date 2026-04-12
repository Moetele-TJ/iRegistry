import PricingPage from "../shared/PricingPage.jsx";

const CASHIER_TOPUP_PATH = "/cashierdashboard/topup";

export default function CashierPricingPage() {
  return (
    <PricingPage
      title="Pricing"
      subtitle="Credits required for each task"
      topUpTo={CASHIER_TOPUP_PATH}
    />
  );
}

