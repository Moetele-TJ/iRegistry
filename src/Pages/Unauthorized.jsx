export default function Unauthorized() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="bg-white p-6 rounded shadow text-center">
        <h1 className="text-2xl font-bold text-red-600 mb-2">
          Access denied
        </h1>
        <p className="text-gray-600">
          You do not have permission to view this page.
        </p>
      </div>
    </div>
  );
}