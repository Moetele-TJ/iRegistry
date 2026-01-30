// src/components/Footer.jsx
export default function Footer() {
  return (
    <footer className="bg-white border-t text-sm text-gray-500">
      <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row justify-between items-center gap-2">
        
        <span>
          © {new Date().getFullYear()} iRegistry. All rights reserved.
        </span>

        <span className="text-xs text-gray-400">
          Keeping it safe
        </span>

      </div>
    </footer>
  );
}