/* eslint-disable react/prop-types */
export default function ConfirmModal({ onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/30 flex items-center justify-center z-20 transition-all duration-700 hover:scale-[1.1] animate-fadeIn">

      <div className="bg-white p-6 rounded-xl shadow-xl text-center w-80 animate-slideUp Justy-Center">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">
          Confirm Action
        </h2>
        <p className="text-sm text-gray-600 mb-6">
  Are you sure you want to mark this item as <b>Stolen</b>?<br /><br />
  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum non
  risus sed libero venenatis fermentum. Integer at faucibus libero. Donec 
  vel ex a neque viverra finibus. Suspendisse potenti. Sed ullamcorper 
  sagittis dui, a commodo magna cursus nec. Cras a porttitor augue, ut 
  faucibus mi. Duis nec odio purus. Praesent id congue leo. Sed ut sapien 
  at turpis aliquet varius. Sed porttitor metus ac nunc pharetra sagittis. 
  Vivamus tincidunt lectus nec nulla suscipit, nec lacinia metus gravida.
</p>

        <div className="flex justify-around">
          <button
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
            onClick={onConfirm}
          >
            Yes, Confirm
          </button>
        </div>
      </div>

      {/* Animations (kept here for simplicity) */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(40px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease forwards;
        }
        .animate-slideUp {
          animation: slideUp 0.3s ease forwards;
        }
      `}</style>
    </div>
  );
}
