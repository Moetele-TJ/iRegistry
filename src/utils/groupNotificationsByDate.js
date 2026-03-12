//  📁 src/utils/groupNotificationsByDate.js
export function groupNotificationsByDate(notifications) {

  const groups = {};

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  function isSameDay(a, b) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  notifications.forEach((n) => {

    const date = new Date(n.createdon);
    let label;

    if (isSameDay(date, today)) {
      label = "Today";
    }
    else if (isSameDay(date, yesterday)) {
      label = "Yesterday";
    }
    else {
      label = date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    }

    if (!groups[label]) {
      groups[label] = [];
    }

    groups[label].push(n);
  });

  return groups;
}