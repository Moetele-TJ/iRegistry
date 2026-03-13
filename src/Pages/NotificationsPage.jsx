// src/pages/NotificationsPage.jsx
import { useNavigate } from "react-router-dom";
import { useNotificationCenter } from "../contexts/NotificationContext";
import { useModal } from "../contexts/ModalContext";
import TimeAgo from "../components/TimeAgo";
import { invokeWithAuth } from "../lib/invokeWithAuth";
import { groupNotificationsByDate } from "../utils/groupNotificationsByDate";
import { getIcon } from "../utils/iconResolver";

export default function NotificationsPage() {

  const navigate = useNavigate();
  const { notifications = [], refresh } = useNotificationCenter();
  const { confirm } = useModal();

  const grouped = groupNotificationsByDate(notifications);
  const unreadCount = notifications.reduce(
    (count, n) => count + (!n.isread ? 1 : 0),
    0
  );

  async function markNotificationRead(id) {
    try {
      await invokeWithAuth("mark-notifications-read", {
        body: { ids: [id] }
      });

      refresh?.();
    } catch (err) {
      console.error("Failed to mark notification read", err);
    }
  }

  async function handleNotificationClick(n) {

    if (!n.isread) {
      await markNotificationRead(n.id);
    }

    if (n.items?.slug) {
      navigate(`/items/${n.items.slug}`);
    }
  }

  async function handleMarkAllRead() {

    const confirmed = await confirm({
      title: "Mark all notifications as read?",
      message: "This will mark all unread notifications as read.",
      confirmLabel: "Mark all",
      cancelLabel: "Cancel",
      variant: "warning"
    });

    if (!confirmed) return;

    try {

      await invokeWithAuth("mark-notifications-read", {
        body: {}
      });

      refresh?.();

    } catch (err) {
      console.error("Failed to mark notifications read", err);
    }
  }

  return (

    <div className="max-w-4xl mx-auto py-8 space-y-4">

      {/* Header */}
      <div className="flex justify-between items-center">

        <h1 className="text-2xl font-semibold">
          Notifications
        </h1>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="text-sm text-iregistrygreen hover:underline"
          >
            Mark all as read ({unreadCount})
          </button>
        )}

      </div>

      {/* Empty state */}
      {notifications.length === 0 && (
        <div className="text-gray-400 text-sm">
          No notifications yet.
        </div>
      )}

      {/* Notifications */}
      {Object.entries(grouped).map(([date, items]) => (

        <div key={date}>

          {/* Date Header */}
          <div className="text-xs font-semibold text-gray-400 uppercase mb-2 mt-6 sticky top-0 bg-gray-100 py-1">
            {date}
          </div>

          <div className="space-y-3">

            {items
              .slice()
              .sort((a, b) => {

                // unread first
                if (a.isread !== b.isread) {
                  return a.isread ? 1 : -1;
                }

                // newest first
                return new Date(b.createdon) - new Date(a.createdon);

              })
              .map((n) => {

              const Icon = getIcon(n);

              return (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`bg-white border rounded-xl p-4 cursor-pointer transition hover:bg-gray-50 ${
                    !n.isread ? "bg-red-50 border-red-200" : ""
                  }`}
                >

                  <div className="flex justify-between items-start gap-3">

                    <div className="flex items-start gap-3">

                      <div className="relative">

                        {Icon && (
                          <Icon size={18} className="text-gray-500 mt-0.5" />
                        )}

                        {!n.isread && (
                          <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-600 rounded-full"></span>
                        )}

                      </div>

                      <div>

                        {n.items?.name && (
                          <div className="text-sm text-gray-500 mb-1">
                            Item: {n.items.name}
                          </div>
                        )}

                        <div className={`text-sm ${
                          !n.isread ? "font-medium text-gray-900" : "text-gray-600"
                        }`}>
                          {n.message}
                        </div>

                        {n.contact && (
                          <div className="text-xs text-gray-500 mt-1">
                            Contact: {n.contact}
                          </div>
                        )}

                        <div className="text-xs text-gray-400 mt-1">
                          <TimeAgo date={n.createdon} />
                        </div>

                      </div>

                    </div>

                    {n.items?.slug && (
                      <span className="text-gray-300 text-lg">
                        ›
                      </span>
                    )}

                  </div>

                </div>
              );

            })}

          </div>

        </div>

      ))}

    </div>

  );
}