import { useEffect, useState } from "react";
import { timeAgo } from "../utils/timeAgo";

export function useTimeAgo(date) {
  const [value, setValue] = useState(() => timeAgo(date));

  useEffect(() => {
    const update = () => setValue(timeAgo(date));

    update(); // initial

    const interval = setInterval(update, 60000); // refresh every minute

    return () => clearInterval(interval);
  }, [date]);

  return value;
}