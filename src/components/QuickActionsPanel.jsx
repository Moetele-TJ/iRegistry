//  src/components/QuickActionsPanel.jsx
import { useNavigate } from "react-router-dom";
import RippleButton from "./RippleButton";

export default function QuickActionsPanel() {
  const navigate = useNavigate();

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
      
      <div className="text-sm uppercase tracking-wide text-gray-500">
        Quick Actions
      </div>

      <div className="space-y-3">
        <RippleButton
          className="w-full py-2 rounded-xl bg-iregistrygreen text-white font-medium"
          onClick={() => navigate("/items/add")}
        >
          + Register New Item
        </RippleButton>

        <RippleButton
          className="w-full py-2 rounded-xl bg-gray-100 text-gray-800"
          onClick={() => navigate("/items")}
        >
          View My Items
        </RippleButton>

        <RippleButton
          className="w-full py-2 rounded-xl bg-red-600 text-white"
          onClick={() => navigate("/items")}
        >
          Report Theft
        </RippleButton>
      </div>

    </div>
  );
}