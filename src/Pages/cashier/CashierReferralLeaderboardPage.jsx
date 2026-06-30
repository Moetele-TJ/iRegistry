import { Navigate } from "react-router-dom";
import { Trophy } from "lucide-react";
import ReferralLeaderboardSection from "../../components/ReferralLeaderboardSection.jsx";
import PageSectionCard from "../shared/PageSectionCard.jsx";
import { NAV } from "../../lib/navLabels.js";
import { useReferralLeaderboardNavVisible } from "../../hooks/useReferralLeaderboardNavVisible.js";

export default function CashierReferralLeaderboardPage() {
  const { visible, loading } = useReferralLeaderboardNavVisible();

  if (!loading && !visible) {
    return <Navigate to="/cashier" replace />;
  }

  return (
    <PageSectionCard
      title={NAV.referralLeaderboard}
      subtitle="Referral competition standings for front-desk staff. Available while the competition runs and for 7 days after it ends."
      icon={<Trophy className="w-6 h-6 text-iregistrygreen shrink-0" />}
    >
      <div className="px-4 sm:px-6 lg:px-8 py-5 sm:py-8">
        {loading ? (
          <div className="text-sm text-gray-500">Loading leaderboard…</div>
        ) : (
          <ReferralLeaderboardSection />
        )}
      </div>
    </PageSectionCard>
  );
}
