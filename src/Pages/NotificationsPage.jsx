// src/pages/NotificationsPage.jsx
import { useCallback, useState } from "react";
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
  const [openNotification, setOpenNotification] = useState(null);

  const grouped = groupNotificationsByDate(notifications);
  const unreadCount = notifications.reduce(
    (count, n) => count + (!n.isread ? 1 : 0),
    0
  );

  const markNotificationRead = useCallback(async (id) => {
    try {
      await invokeWithAuth("mark-notifications-read", {
        body: { ids: [id] }
      });

      refresh?.();
    } catch (err) {
      console.error("Failed to mark notification read", err);
    }
  }, [refresh]);

  const closeNotificationModal = useCallback(async () => {
    const n = openNotification;
    setOpenNotification(null);
    if (n?.id && !n?.isread) {
      await markNotificationRead(n.id);
    }
  }, [markNotificationRead, openNotification]);

  function handleNotificationClick(n) {
    if (!n?.id) return;
    setOpenNotification(n);
  }

  const handleListItemNameClick = useCallback(async (e, n) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (!n?.items?.slug) return;
    if (n?.id && !n?.isread) {
      await markNotificationRead(n.id);
    }
    navigate(`/items/${n.items.slug}`);
  }, [markNotificationRead, navigate]);

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
                            Item:{" "}
                            {n.items?.slug ? (
                              <button
                                type="button"
                                onClick={(e) => handleListItemNameClick(e, n)}
                                className="font-medium text-emerald-900 hover:underline"
                              >
                                {n.items.name}
                              </button>
                            ) : (
                              <span className="font-medium text-gray-700">
                                {n.items.name}
                              </span>
                            )}
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

      {/* Notification details modal */}
      {openNotification ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity"
            onClick={closeNotificationModal}
            aria-hidden="true"
          />

          <div
            role="dialog"
            aria-modal="true"
            className="relative rounded-xl shadow-md w-full max-w-xs sm:max-w-sm mx-4 max-h-[90vh] overflow-y-auto z-10 border bg-white border-gray-100"
          >
            {/* Branded header */}
            <div className="relative rounded-t-xl bg-iregistrygreen px-5 py-4 text-white">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-white/15 flex items-center justify-center border border-white/20">
                    <span className="text-sm font-bold">iR</span>
                  </div>
                  <div>
                    <div className="text-xs text-white/80">iRegistry</div>
                    <h3 className="text-base font-semibold leading-tight">
                      Notification
                    </h3>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={closeNotificationModal}
                  className="rounded-lg px-2 py-1 text-white/90 hover:text-white hover:bg-white/10"
                  aria-label="Close notification"
                >
                  ✕
                </button>
              </div>

              {!openNotification.isread ? (
                <div className="mt-3 inline-flex items-center rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium border border-white/20">
                  Unread
                </div>
              ) : null}
            </div>

            <div className="px-5 py-4 space-y-3 text-sm text-gray-700 mb-1">
              {openNotification.items?.name ? (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Item</div>
                  <div className="font-semibold text-gray-900">
                    {openNotification.items.name}
                  </div>
                </div>
              ) : null}

              <div>
                <div className="text-xs text-gray-500 mb-1">Message</div>
                <div className="text-gray-900 whitespace-pre-wrap">
                  {openNotification.message}
                </div>
              </div>

              {openNotification.contact ? (
                <div>
                  <div className="text-xs text-gray-500 mb-1">Contact</div>
                  <div className="text-gray-900">{openNotification.contact}</div>
                </div>
              ) : null}

              <div className="text-xs text-gray-500">
                <TimeAgo date={openNotification.createdon} />
              </div>
            </div>

            <div className="px-5 pb-5 flex justify-end">
              <button
                type="button"
                onClick={closeNotificationModal}
                className="px-4 py-2 rounded-lg bg-iregistrygreen text-white hover:opacity-90"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </PageSectionCard>

  );
}