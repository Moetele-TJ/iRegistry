//  📁 src/components/DashboardAlertsPanel.jsx
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { getIcon } from "../utils/iconResolver";
import TimeAgo from "./TimeAgo";
import { invokeWithAuth } from "../lib/invokeWithAuth";
import { useModal } from "../contexts/ModalContext.jsx";

export default function DashboardAlertsPanel({ alerts }) {
  const navigate = useNavigate();
  const [expandedItems, setExpandedItems] = useState({});
  const { confirm } = useModal();

  async function markItemAlertsRead(itemId) {
    try {
      const ok = await confirm({
        title: "Confirm",
        message: "Mark these item alerts as read?",
        confirmLabel: "Mark as read",
        cancelLabel: "Cancel",
      }).catch(() => false);
      if (!ok) return;

      await invokeWithAuth("mark-notifications-read", {
        body: { itemId }
      });
    } catch (err) {
      console.error("Failed to mark alerts as read", err);
    }
  }

  function toggleItem(itemId) {
    setExpandedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  }

  const groupedAlerts = useMemo(
    () =>
      alerts.reduce((acc, alert) => {
        const key = alert.itemid; // use ID internally

        if (!acc[key]) {
          acc[key] = {
            itemName: alert.items?.name || "Item",
            alerts: []
          };
        }

        acc[key].alerts.push(alert);

        return acc;
      }, {}),
    [alerts]
  );

  useEffect(() => {
    const autoExpand = {};

    Object.entries(groupedAlerts).forEach(([itemId, group]) => {
      const hasUnread = group.alerts.some(alert => !alert.isread);

      if (hasUnread) {
        autoExpand[itemId] = true;
      }
    });

    setExpandedItems(autoExpand);

  }, [groupedAlerts]);

  const unreadCount = alerts.filter(alert => !alert.isread).length;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">

      <h2 className="text-sm uppercase tracking-wide text-gray-500 mb-4 flex items-center gap-2">
        Recent Alerts

        {unreadCount > 0 && (
          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
            {unreadCount}
          </span>
        )}
      </h2>

      {alerts.length === 0 && (
        <div className="text-sm text-gray-400">
          No alerts
        </div>
      )}

      {Object.entries(groupedAlerts)
        .sort((a, b) => {
          const latestA = Math.max(...a[1].alerts.map(alert => new Date(alert.createdon)));
          const latestB = Math.max(...b[1].alerts.map(alert => new Date(alert.createdon)));
          return latestB - latestA;
        })
        .map(([itemId, group]) => (
          <div key={itemId} className="mb-4">

            {/* Item header */}
            <div
              onClick={() => toggleItem(itemId)}
              className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-2 cursor-pointer select-none hover:text-gray-700 transition"
            >
              <span
                className={`text-gray-400 transition-transform duration-200 ${
                  expandedItems[itemId] ? "rotate-90" : "rotate-0"
                }`}
                >
                ▶
              </span>

              <span>{group.itemName}</span>

              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {group.alerts.length}
              </span>
            </div>

            {/* Alerts */}
            {expandedItems[itemId] && group.alerts
              .sort((a, b) => new Date(b.createdon) - new Date(a.createdon))
              .map((alert) => (
                <div
                  key={alert.id}
                  onClick={async () => {

                    if (!alert.isread) {
                      await markItemAlertsRead(alert.itemid);
                    }

                    if (alert.items?.slug) {
                      navigate(`/items/${alert.items.slug}`);
                    }

                  }}
                  className={`flex items-start gap-3 py-2 border-b last:border-0 cursor-pointer hover:bg-gray-50 transition ${
                    !alert.isread ? "bg-red-50" : ""
                  }`}
                >
                  <div className="relative flex items-center justify-center w-6">
                    {(() => {
                      const Icon = getIcon(alert);
                      return <Icon size={18} className="text-gray-500" />;
                    })()}

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