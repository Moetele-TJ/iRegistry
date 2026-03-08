//  📁 src/components/DashboardAlertsPanel.jsx
import { useNavigate } from "react-router-dom";
import { getAlertIcon } from "../utils/alertIcon";
import TimeAgo from "./TimeAgo";

export default function DashboardAlertsPanel({ alerts }) {
  const navigate = useNavigate();

  const groupedAlerts = alerts.reduce((acc, alert) => {
    const itemName = alert.items?.name || "Item";

    if (!acc[itemName]) {
      acc[itemName] = [];
    }

    acc[itemName].push(alert);

    return acc;
  }, {});

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">

      <h2 className="text-sm uppercase tracking-wide text-gray-500 mb-4">
        Recent Alerts
      </h2>

      {alerts.length === 0 && (
        <div className="text-sm text-gray-400">
          No alerts
        </div>
      )}

      {Object.entries(groupedAlerts)
        .sort((a, b) => {
          const latestA = Math.max(...a[1].map(alert => new Date(alert.createdon)));
          const latestB = Math.max(...b[1].map(alert => new Date(alert.createdon)));
          return latestB - latestA;
        })
        .map(([itemName, itemAlerts]) => (
          <div key={itemName} className="mb-4">

            {/* Item header */}
            <div className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-2">
              <span>{itemName}</span>

              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {itemAlerts.length}
              </span>
            </div>

            {/* Alerts */}
            {itemAlerts
              .sort((a, b) => new Date(b.createdon) - new Date(a.createdon))
              .map((alert) => (
                <div
                  key={alert.id}
                  onClick={() =>
                    alert.items?.slug &&
                    navigate(`/items/${alert.items.slug}`)
                  }
                  className={`flex items-start gap-3 py-2 border-b last:border-0 cursor-pointer hover:bg-gray-50 transition ${
                    !alert.isread ? "bg-red-50" : ""
                  }`}
                >
                  <div className="relative flex items-center justify-center w-6">
                    <span className="text-lg">
                      {getAlertIcon(alert.message)}
                    </span>

                    {!alert.isread && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-600 rounded-full"></span>
                    )}
                  </div>

                  <div className="flex flex-col">
                    <div
                      className={`text-sm ${
                        !alert.isread
                          ? "text-gray-900 font-medium"
                          : "text-gray-600"
                      }`}
                    >
                      {alert.message}
                    </div>

                    <div className="text-xs text-gray-400 mt-1">
                      <TimeAgo date={alert.createdon} />
                    </div>
                  </div>
                </div>
              ))}
          </div>
        ))}

      <div className="mt-3 text-right">
        <button
          onClick={() => navigate("/notifications")}
          className="text-sm text-iregistrygreen hover:underline"
        >
          View all notifications
        </button>
      </div>

    </div>
  );
}