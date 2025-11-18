import Header from "../components/Header";
import RippleButton from "../components/RippleButton";

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <Header />


      {/* Top Bar */}
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-iregistry-green justify-center">
          
          Welcome to your Dashboard
          
          </h1>

        <div className="flex items-center space-x-4">
          <span className="text-gray-600">Hello, User</span>
          <img
            src="https://i.pravatar.cc/40"
            alt="avatar"
            className="w-10 h-10 rounded-full border"
          />
        </div>
      </header>

      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white shadow rounded-xl p-6">
          <p className="text-gray-500">Total Items</p>
          <p className="text-3xl font-bold">0</p>
        </div>

        <div className="bg-white shadow rounded-xl p-6">
          <p className="text-gray-500">Active Items</p>
          <p className="text-3xl font-bold">0</p>
        </div>

        <div className="bg-white shadow rounded-xl p-6">
          <p className="text-gray-500">Stolen Items</p>
          <p className="text-3xl font-bold">0</p>
        </div>
      </div>

      {/* Items List */}
      <div className="bg-white shadow rounded-xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Your Registered Items</h2>

          <RippleButton
          className="px-4 py-2 bg-iregistry-green text-white rounded-lg shadow-lg hover:bg-blue-500 transition">
            Add New Item
          </RippleButton>
        </div>

        <p className="text-gray-500">No items yet. Add one to get started.</p>
      </div>

    </div>
  );
}