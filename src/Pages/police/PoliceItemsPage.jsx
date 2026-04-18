import { useSearchParams } from "react-router-dom";
import Items from "../Items.jsx";

export default function PoliceItemsPage() {
  const [params] = useSearchParams();
  const mine = params.get("mine");
  const defaultStationQueue = mine !== "1";
  return <Items defaultPoliceStationStolenView={defaultStationQueue} />;
}
