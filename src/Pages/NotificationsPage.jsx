// src/pages/NotificationsPage.jsx
import { useNavigate } from "react-router-dom";
import { useNotificationCenter } from "../contexts/NotificationContext";
import { useModal } from "../contexts/ModalContext";
import TimeAgo from "../components/TimeAgo";
import { invokeWithAuth } from "../lib/invokeWithAuth";
import { groupNotificationsByDate } from "../utils/groupNotificationsByDate";
import { getIcon } from "../utils/iconResolver";
import PageSectionCard from "./shared/PageSectionCard.jsx";

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
    if (!n?.id) return;

    // Unread: open a modal first, then mark as read when it closes.
    if (!n.isread) {
      const hasItem = !!n.items?.slug;
      const chosen = await confirm({
        title: "Notification",
        message: (
          <div className="space-y-3">
            {n.items?.name ? (
              <div className="text-sm text-gray-700">
                <span className="text-gray-500">Item:</span>{" "}
                <span className="font-semibold text-gray-900">{n.items.name}</span>
              </div>
            ) : null}
            <div className="text-sm text-gray-900 whitespace-pre-wrap">{n.message}</div>
            {n.contact ? (
              <div className="text-sm text-gray-700">
                <span className="text-gray-500">Contact:</span> {n.contact}
              </div>
            ) : null}
            <div className="text-xs text-gray-500">
              <TimeAgo date={n.createdon} />
            </div>
          </div>
        ),
        confirmLabel: hasItem ? "Open item" : "Close",
        cancelLabel: "Close",
        variant: hasItem ? "default" : "default",
      }).catch(() => false);

      await markNotificationRead(n.id);

      if (chosen && n.items?.slug) {
        navigate(`/items/${n.items.slug}`);
      }
      return;
    }

    // Read: keep previous behavior (go to item if linked).
    if (n.items?.slug) {
      navigate(`/items/${n.items.slug}`);
    }
  }

  async function handleMarkAllRead() {

    const confirmed = await confirm({
      title: "Confirm",
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
    <PageSectionCard
      maxWidthClass="max-w-7xl"
      title="Notifications"
      subtitle={
        unreadCount > 0
          ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
          : "Your activity updates"
      }
      actions={
        unreadCount > 0 ? (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="text-sm font-medium text-emerald-900 hover:underline"
          >
            Mark all as read ({unreadCount})
          </button>
        ) : null
      }
    >
      <div className="p-4 sm:p-6 space-y-6">
      {/* Empty state */}
      {notifications.length === 0 && (
        <div className="text-gray-400 text-sm text-center py-10">
          No notifications yet.
        </div>
      )}

      {/* Notifications */}
      {Object.entries(grouped).map(([date, items]) => (

        <div key={date}>

          {/* Date Header */}
          <div className="flex items-center gap-3 text-xs font-semibold text-gray-500 uppercase mt-8 mb-3">
            <div className="h-px flex-1 bg-gray-200"></div>
            <span className="whitespace-nowrap">{date}</span>
            <div className="h-px flex-1 bg-gray-200"></div>
          </div>

          <div className="space-y-3">

            {items
              .slice()
              .sort((a, b) => {

                if (a.isread !== b.isread) {
                  return a.isread ? 1 : -1;
                }

                return new Date(b.createdon) - new Date(a.createdon);

              })
              .map((n) => {

              const Icon = getIcon(n);

              return (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`relative bg-white border rounded-xl p-4 cursor-pointer transition-all duration-150
                  hover:bg-gray-50 hover:shadow-sm hover:-translate-y-[1px]
                  ${!n.isread ? "border-red-200 bg-red-50" : ""}`}
                >

                  {/* unread bar */}
                  {!n.isread && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500 rounded-l-xl"></div>
                  )}

                  <div className="flex justify-between items-start gap-3">

                    <div className="flex items-start gap-3">

                      {/* icon bubble */}
                      <div className={`w-9 h-9 flex items-center justify-center rounded-full
                        ${!n.isread ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-500"}`}>

                        {Icon && <Icon size={18} />}
                      </div>

                      <div>

                        {n.items?.name && (
                          <div className="text-xs text-gray-500 mb-1">
                            Item: {n.items.name}
                          </div>
                        )}

                        <div className={`text-sm ${
                          !n.isread
                            ? "font-semibold text-gray-900"
                            : "text-gray-600"
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
    </PageSectionCard>

  );
}