// src/App.jsx
import BottomNav from "./components/BottomNav";

export default function App({ children }) {
  return (
    <div className="bg-gray-50 min-h-screen flex flex-col pb-16">
      {/* Top header (optional) */}
      {/* <Header /> */}

      {/* Main content */}
      <div className="flex-1 px-4 sm:px-6 md:px-8 pt-4">
        {children}
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
