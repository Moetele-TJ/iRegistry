//  src/components/QuickActionsPanel.jsx
import { useNavigate } from "react-router-dom";
import RippleButton from "./RippleButton";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useAddItemPreflight } from "../hooks/useAddItemPreflight.js";
import { NAV_ACTIONS } from "../lib/navLabels.js";
import { useRegisterAnimalPreflight } from "../hooks/useRegisterAnimalPreflight.js";

export default function QuickActionsPanel() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { goToAddItem, tasksLoading } = useAddItemPreflight();
  const { goToRegisterAnimal, tasksLoading: animalPreflightLoading } = useRegisterAnimalPreflight();
  const promoActive = Boolean(user?.promo_active);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
      <div className="text-sm uppercase tracking-wide text-gray-500">
        {NAV_ACTIONS.quickActions}
      </div>

      <div className="space-y-3">
        <RippleButton
          className="w-full py-2 rounded-xl bg-iregistrygreen text-white font-medium disabled:opacity-60"
          onClick={() => void goToAddItem()}
          disabled={tasksLoading}
          title={tasksLoading ? "Loading credit prices…" : undefined}
        >
          {promoActive ? `+ ${NAV_ACTIONS.registerItem}` : `+ ${NAV_ACTIONS.registerNewItem}`}
        </RippleButton>

        <RippleButton
          className="w-full py-2 rounded-xl bg-gray-100 text-gray-800"
          onClick={() => navigate("/items")}
        >
          {NAV_ACTIONS.viewMyItems}
        </RippleButton>

        <RippleButton
          className="w-full py-2 rounded-xl bg-red-600 text-white"
          onClick={() => navigate("/items")}
        >
          {NAV_ACTIONS.reportTheft}
        </RippleButton>

        <RippleButton
          className="w-full py-2 rounded-xl bg-iregistrygreen text-white font-medium disabled:opacity-60"
          onClick={() =>
            void goToRegisterAnimal({ path: "/user/livestock/register" })
          }
          disabled={animalPreflightLoading}
          title={animalPreflightLoading ? "Loading credit prices…" : undefined}
        >
          {`+ ${NAV_ACTIONS.registerAnimal}`}
        </RippleButton>

        <RippleButton
          className="w-full py-2 rounded-xl bg-gray-100 text-gray-800"
          onClick={() => navigate("/user/livestock")}
        >
          {NAV_ACTIONS.viewMyLivestock}
        </RippleButton>

        <RippleButton
          className="w-full py-2 rounded-xl bg-orange-600 text-white"
          onClick={() => navigate("/user/livestock/missing")}
        >
          {NAV_ACTIONS.reportMissingAnimal}
        </RippleButton>
      </div>
    </div>
  );
}
