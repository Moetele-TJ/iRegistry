export default function Spinner({ label = "Loading..." }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-iregistrygreen mb-4" />
      <p className="text-sm text-gray-600">{label}</p>
    </div>
  );
}