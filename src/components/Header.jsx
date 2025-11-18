import logo from "../assets/iregistry-logo.png";

export default function Header() {
  return (
    <header className="w-full bg-white shadow-lg py-3 px-4 md:px-8 flex items-center rounded-lg justify-between sticky top-0 z-50">

      {/* Logo section */}
      <div className="flex items-center gap-3">
        <img
        
          src={logo}
          alt="iRegistry Logo"
          className="h-10 md:h-20 object-contain"

        />
      </div>

      {/* Placeholder for future navigation */}
      <div className="hidden md:flex gap-6 text-gray-600">
        <button className="hover:text-gray-900 transition">Dashboard</button>
        <button className="hover:text-gray-900 transition">Items</button>
        <button className="hover:text-gray-900 transition">Profile</button>
      </div>

    </header>
  );
}
