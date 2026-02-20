// src/Pages/ItemDetails.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import RippleButton from "../components/RippleButton.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";
import Toast from "../components/Toast.jsx";
import { useItems } from "../contexts/ItemsContext.jsx";

function fmtDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function ItemDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { items, deleteItem } = useItems();

  const [item, setItem] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false); // modal state
  const [working, setWorking] = useState(false);

  // toast state
  const [toast, setToast] = useState({ visible: false, message: "", type: "info" });

  useEffect(() => {
    const found = (items || []).find((it) => String(it.id) === String(id));
    setItem(found || null);
  }, [id, items]);

  function openDeleteModal() {
    setConfirmOpen(true);
  }

  function closeDeleteModal() {
    setConfirmOpen(false);
  }

  async function performDelete() {
    if (!item) return;
    try {
      setWorking(true);
      const res = deleteItem(item.id);
      if (res && typeof res.then === "function") {
        await res;
      }
      // show success toast briefly then navigate
      setToast({ visible: true, message: `${item.name || item.id} deleted`, type: "success" });
      // small delay so user sees toast before navigation
      setTimeout(() => {
        setToast({ visible: false, message: "", type: "info" });
        navigate("/items");
      }, 900);
    } catch (e) {
      console.error("Failed to delete item:", e);
      setToast({ visible: true, message: "Failed to delete item", type: "error" });
      setTimeout(() => setToast({ visible: false, message: "", type: "info" }), 2500);
    } finally {
      setWorking(false);
      setConfirmOpen(false);
    }
  }

  // wrapper that ConfirmModal can call as action
  function handleDeleteAction(arg) {
    // arg is ignored; we already know item id in closure
    void performDelete();
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-gray-100">
        <div className="p-6 max-w-3xl mx-auto">
          <div className="bg-white p-6 rounded-lg shadow-sm text-center">
            <h2 className="text-lg font-semibold">Item not found</h2>
            <p className="text-sm text-gray-500 mt-2">The requested item does not exist.</p>
            <div className="mt-4 flex gap-2 justify-center">
              <RippleButton className="px-4 py-2 rounded border bg-white" onClick={() => navigate("/items")}>
                Back to items
              </RippleButton>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="p-6 sm:p-8 max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Left: image / placeholder */}
            <div className="md:w-1/3 flex items-center justify-center">
              {item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.name || "Item photo"}
                  className="w-48 h-48 object-cover rounded-lg border"
                  onError={(e) => {
                    e.currentTarget.src = "";
                  }}
                />
              ) : (
                <div className="w-48 h-48 bg-gray-50 rounded-lg border flex items-center justify-center text-gray-400">
                  <div className="text-4xl">☁</div>
                </div>
              )}
            </div>

            {/* Right: details */}
            <div className="md:w-2/3">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-extrabold text-iregistrygreen">{item.name || "Untitled"}</h1>
                  <div className="text-sm text-gray-500">Serial: {item.serial1 || "—"}</div>
                </div>

                <div className="flex gap-3 mt-1">
                  <RippleButton
                    className="px-4 py-2 rounded border bg-white text-sm"
                    onClick={() => navigate("/items")}
                  >
                    Back
                  </RippleButton>

                  <RippleButton
                    className="px-4 py-2 rounded bg-iregistrygreen text-white text-sm"
                    onClick={() => navigate(`/items/${item.id}/edit`)}
                  >
                    Edit
                  </RippleButton>

                  <RippleButton
                    className="px-4 py-2 rounded bg-red-600 text-white text-sm"
                    onClick={openDeleteModal}
                  >
                    Delete
                  </RippleButton>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-xs text-gray-500">Category</div>
                  <div className="text-gray-800">{item.category || "—"}</div>
                </div>

                <div>
                  <div className="text-xs text-gray-500">Status</div>
                  <div className={`font-semibold ${item.status === "Stolen" ? "text-red-600" : "text-green-600"}`}>
                    {item.status || "—"}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500">Make / Model</div>
                  <div className="text-gray-800">
                    {(item.make || "") + (item.model ? ` / ${item.model}` : "") || "—"}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-500">Last seen / Purchase date</div>
                  <div className="text-gray-800">{item.lastSeen || item.purchaseDate || "—"}</div>
                </div>

                <div>
                  <div className="text-xs text-gray-500">Location</div>
                  <div className="text-gray-800">{item.location || "—"}</div>
                </div>

                <div>
                  <div className="text-xs text-gray-500">Estimated value</div>
                  <div className="text-gray-800">{item.value || item.estimatedValue || "—"}</div>
                </div>

                <div>
                  <div className="text-xs text-gray-500">Serial 1</div>
                  <div className="text-gray-800">{item.serial1 || "—"}</div>
                </div>

                <div>
                  <div className="text-xs text-gray-500">Serial 2</div>
                  <div className="text-gray-800">{item.serial2 || "—"}</div>
                </div>

                <div className="sm:col-span-2">
                  <div className="text-xs text-gray-500">Notes / Owner Info</div>
                  <div className="text-gray-800 whitespace-pre-wrap">{item.ownerInfo || item.notes || "—"}</div>
                </div>

                <div>
                  <div className="text-xs text-gray-500">Bought from (Shop)</div>
                  <div className="text-gray-800">{item.shop || "—"}</div>
                </div>

                <div>
                  <div className="text-xs text-gray-500">Warranty expiry</div>
                  <div className="text-gray-800">{item.warrantyExpiry || "—"}</div>
                </div>

                <div className="sm:col-span-2">
                  <div className="text-xs text-gray-500">Description</div>
                  <div className="text-gray-800 whitespace-pre-wrap">{item.description || "—"}</div>
                </div>
              </div>

              <hr className="my-6" />

              <div className="text-xs text-gray-500 grid grid-cols-2 gap-4">
                <div>
                  <div>Created on</div>
                  <div className="text-gray-700">{fmtDate(item.createdOn)}</div>
                </div>
                <div>
                  <div>Updated on</div>
                  <div className="text-gray-700">{fmtDate(item.updatedOn)}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ConfirmModal (shared component) */}
      <ConfirmModal
        isOpen={confirmOpen}
        onClose={closeDeleteModal}
        action={handleDeleteAction}
        // actionArg could be item.id if you prefer the modal to pass it
        actionArg={item?.id}
        afterConfirm={() => {
          /* performDelete already shows toast and navigates; keep extra safety */
          // no-op here (performDelete handles toast/navigation)
        }}
        title="Confirm delete"
        message={
          <>
            Are you sure you want to delete <span className="font-medium">{item.name || item.id}</span>? This action cannot be undone.
          </>
        }
        confirmLabel={working ? "Deleting..." : "Delete"}
        cancelLabel="Cancel"
        danger={true}
      />

      {/* Toast */}
      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onClose={() => setToast({ visible: false, message: "", type: "info" })}
      />
    </div>
  );
}