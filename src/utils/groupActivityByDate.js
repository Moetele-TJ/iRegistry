//  src/utils/groupActivityByDate.js
export function groupActivityByDate(activity) {

    const groups = {};

    activity.forEach(item => {

        const date = new Date(item.created_at);
        const today = new Date();
        const yesterday = new Date();
        yesterday.setDate(today.getDate() - 1);

        let label;

        if (date.toDateString() === today.toDateString()) {
            label = "Today";
        }
        else if (date.toDateString() === yesterday.toDateString()) {
            label = "Yesterday";
        }
        else {
            label = date.toLocaleDateString("en-BW", {
                year: "numeric",
                month: "short",
                day: "numeric"
            });
        }

        if (!groups[label]) {
            groups[label] = [];
        }

        groups[label].push(item);

    });

    return groups;

}