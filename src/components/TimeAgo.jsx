import { useTimeAgo } from "../hooks/useTimeAgo";

export default function TimeAgo({ date }) {
  const value = useTimeAgo(date);

  return (
    <span>
      {value}
    </span>
  );
}