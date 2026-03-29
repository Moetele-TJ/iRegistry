// src/Pages/ItemDetails.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import RippleButton from "../components/RippleButton.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";
import Toast from "../components/Toast.jsx";
import { useItems } from "../contexts/ItemsContext.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { invokeWithAuth } from "../lib/invokeWithAuth.js";
import ItemActivityTimeline from "../components/ItemActivityTimeline";
import { useItemActivity } from "../hooks/useItemActivity";

function fmtDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function formatPoliceCaseStatusLabel(status) {
  if (!status) return "—";
  const map = {
    Open: "Open",
    InCustody: "In custody",
    ClearedForReturn: "Cleared for return",
    ReturnedToOwner: "Returned to owner",
  };
  return map[status] || status;
}

function normalizePoliceCaseRow(row) {
  if (!row || typeof row !== "object") return null;
  return {
    id: row.id,
    status: row.status,
    station: row.station,
    stationSource: row.station_source,
    openedAt: row.opened_at,
    clearedAt: row.cleared_at,
    returnedAt: row.returned_at,
    notes: row.notes,
    evidence: row.evidence,
  };
}

export default function ItemDetails() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { items, deleteItem } = useItems();
  const { user } = useAuth();

  const [item, setItem] = useState(null);
  const [policeCaseDetail, setPoliceCaseDetail] = useState(null);
  const [policeCaseLoading, setPoliceCaseLoading] = useState(false);
  const { activity, loading } = useItemActivity(item?.id);
  const [confirmOpen, setConfirmOpen] = useState(false); // modal state
  const [working, setWorking] = useState(false);

  // toast state
  const [toast, setToast] = useState({ visible: false, message: "", type: "info" });

  useEffect(() => {
    const found = (items || []).find((it) => String(it.slug) === String(slug));
    setItem(found || null);
  }, [slug, items]);

  useEffect(() => {
    if (!item?.id || item.status !== "Stolen") {
      setPoliceCaseDetail(null);
      return;
    }

    let cancelled = false;
    setPoliceCaseLoading(true);

    (async () => {
      try {
        const { data, error } = await invokeWithAuth("get-item-police-case", {
          body: { itemId: item.id },
        });
        if (cancelled) return;
        if (error && !data?.message) {
          setPoliceCaseDetail(null);
          return;
        }
        if (data?.success && data.case) {
          setPoliceCaseDetail(normalizePoliceCaseRow(data.case));
        } else {
          setPoliceCaseDetail(null);
        }
      } catch {
        if (!cancelled) setPoliceCaseDetail(null);
      } finally {
        if (!cancelled) setPoliceCaseLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [item?.id, item?.status]);

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

                {item.status === "Stolen" && (
                  <div className="sm:col-span-2">
                    {policeCaseLoading && (
                      <p className="text-xs text-gray-400">Loading police case…</p>
                    )}
                    {!policeCaseLoading && policeCaseDetail && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-4 space-y-2 text-sm">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                          Police recovery case
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-gray-800">
                          <div>
                            <span className="text-gray-500 text-xs">Case status</span>
                            <div className="font-medium">
                              {formatPoliceCaseStatusLabel(policeCaseDetail.status)}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-500 text-xs">Reporting station</span>
                            <div>{policeCaseDetail.station || "—"}</div>
                          </div>
                          {policeCaseDetail.openedAt && (
                            <div>
                              <span className="text-gray-500 text-xs">Opened</span>
                              <div>{fmtDate(policeCaseDetail.openedAt)}</div>
                            </div>
                          )}
                          {policeCaseDetail.clearedAt && (
                            <div>
                              <span className="text-gray-500 text-xs">Cleared for return</span>
                              <div>{fmtDate(policeCaseDetail.clearedAt)}</div>
                            </div>
                          )}
                        </div>
                        {policeCaseDetail.notes && (
                          <div>
                            <div className="text-gray-500 text-xs mb-0.5">Case notes</div>
                            <div className="text-gray-800 whitespace-pre-wrap text-sm border-t border-slate-200/80 pt-2">
                              {policeCaseDetail.notes}
                            </div>
                          </div>
                        )}
                        {policeCaseDetail.evidence &&
                          typeof policeCaseDetail.evidence === "object" && (
                            <div>
                              <div className="text-gray-500 text-xs mb-0.5">Evidence (record)</div>
                              <pre className="text-xs bg-white/80 border border-slate-100 rounded-lg p-2 overflow-x-auto whitespace-pre-wrap font-mono text-gray-700">
                                {JSON.stringify(policeCaseDetail.evidence, null, 2)}
                              </pre>
                            </div>
                          )}
                      </div>
                    )}
                    {!policeCaseLoading && !policeCaseDetail && user && (
                      <p className="text-xs text-gray-400">
                        No open police case on file, or you don&apos;t have access to case details.
                      </p>
                    )}
                  </div>
                )}

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

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">

        <h2 className="text-sm uppercase tracking-wide text-gray-500 mb-4">
          Activity Timeline
        </h2>

        <ItemActivityTimeline events={activity} />

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