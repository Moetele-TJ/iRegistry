import { Link } from "react-router-dom";

export default function PoliceHome() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-iregistrygreen">Police Dashboard</h1>
      <p className="text-sm text-gray-600 mt-2">
        Open the Items page and enable <strong>Station stolen queue</strong> to see cases
        reported to your station (matched on the case record, not the item location).
      </p>
      <Link
        to="/policedashboard/items"
        className="inline-block mt-4 px-4 py-2 rounded-xl bg-iregistrygreen text-white text-sm font-medium hover:opacity-90"
      >
        Go to Items
      </Link>
    </div>
  );
}
