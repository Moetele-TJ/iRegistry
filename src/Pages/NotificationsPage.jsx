// src/pages/NotificationsPage.jsx
import { useEffect } from "react";
import { useNotificationCenter } from "../contexts/NotificationContext";
import { invokeWithAuth } from "../lib/invokeWithAuth";

export default function NotificationsPage() {

  const { notifications = [], refresh } = useNotificationCenter();

  useEffect(() => {
    async function markRead() {
      try {
        await invokeWithAuth("mark-notifications-read", {
          body: {}
        });

        refresh();
      } catch (err) {
        console.error("Failed to mark notifications read", err);
      }
    }

    markRead();
  }, [refresh]);

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-4">

      <h1 className="text-2xl font-semibold">Notifications</h1>

      {notifications?.length === 0 && (
        <div className="text-gray-400 text-sm">
          No notifications yet.
        </div>
      )}

      {notifications?.map((n) => (
        <div
          key={n.id}
          className="bg-white border rounded-xl p-4"
        >
          <div className="text-sm text-gray-800">
            {n.message}
          </div>

          <div className="text-xs text-gray-400 mt-1">
            {new Date(n.createdon).toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}