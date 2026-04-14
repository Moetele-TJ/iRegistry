// src/components/Footer.jsx
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="shrink-0 bg-white border-t text-sm text-gray-500">
      <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-center gap-3">
        <span>
          © {new Date().getFullYear()} iRegistry. All rights reserved.
        </span>

        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs md:text-sm">
          <Link to="/terms" className="text-iregistrygreen hover:underline font-medium">
            Terms &amp; conditions
          </Link>
          <Link to="/guide" className="text-gray-600 hover:text-iregistrygreen hover:underline">
            User guide
          </Link>
          <Link to="/faq" className="text-gray-600 hover:text-iregistrygreen hover:underline">
            FAQ
          </Link>
        </div>

        <span className="text-xs text-gray-400">
          Keeping it safe
        </span>
      </div>
    </footer>
  );
}