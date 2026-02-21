// src/Pages/Items.jsx
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import RippleButton from "../components/RippleButton.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";
import Toast from "../components/Toast.jsx";
import { useItems } from "../contexts/ItemsContext.jsx";

function formatCurrency(value) {
  if (value == null) return "-";

  return new Intl.NumberFormat("en-BW", {
    style: "currency",
    currency: "BWP",
    currencyDisplay: "symbol", // shows P
  }).format(value);
  
}

export default function Items() {
  const navigate = useNavigate();
    const {
    items: ctxItems = [],
    loading,
    error,
    updateItem,
    deleteItem,
  } = useItems();

  // UI state
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All"); // All / Active / Stolen
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sortBy, setSortBy] = useState("name"); // name | lastSeen | status
  const [page, setPage] = useState(1);
  const perPage = 8;

  // Confirm modal state (new pattern: action + arg passed into modal)
  const [confirm, setConfirm] = useState({
    isOpen: false,
    title: "",
    message: "",
    confirmLabel: "Confirm",
    cancelLabel: "Cancel",
    danger: false,
    action: null, // function to call on confirm (modal will call it)
    arg: undefined,
    afterConfirmMessage: null,
  });

  // Toast state (keeps Toast component usage compatible)
  const [toast, setToast] = useState({ message: "", type: "info", visible: false });

  function openConfirm(opts = {}) {
    setConfirm({
      isOpen: true,
      title: opts.title || "Confirm",
      message: opts.message || "Are you sure?",
      confirmLabel: opts.confirmLabel || "Confirm",
      cancelLabel: opts.cancelLabel || "Cancel",
      danger: !!opts.danger,
      action: typeof opts.action === "function" ? opts.action : null,
      arg: opts.arg,
      afterConfirmMessage: opts.afterConfirmMessage || null,
    });
  }

  function closeConfirm() {
    setConfirm({
      isOpen: false,
      title: "",
      message: "",
      confirmLabel: "Confirm",
      cancelLabel: "Cancel",
      danger: false,
      action: null,
      arg: undefined,
      afterConfirmMessage: null,
    });
  }

  function handleAfterConfirm() {
    // called by modal via afterConfirm prop
    if (confirm.afterConfirmMessage) {
      setToast({ message: confirm.afterConfirmMessage, type: "success", visible: true });
      // hide toast after a short delay
      setTimeout(() => setToast((t) => ({ ...t, visible: false })), 2500);
    }
  }

  // derived items (from context)
  const items = ctxItems || [];

  useEffect(() => {
    if (items.length > 0) {
      console.log("ITEM SAMPLE:", items[0]);
    }
  }, [items]);

  const categories = useMemo(() => {
    const s = new Set(items.map((i) => i.category).filter(Boolean));
    return Array.from(s).sort();
  }, [items]);

  const filtered = useMemo(() => {
    let list = items.slice();

    if (statusFilter !== "All") list = list.filter((i) => i.status === statusFilter);
    if (categoryFilter !== "All") list = list.filter((i) => i.category === categoryFilter);

    const qTrim = (query || "").trim();
    if (qTrim) {
      const q = qTrim.toLowerCase();
      list = list.filter(
        (i) =>
          (i.name && i.name.toLowerCase().includes(q)) ||
          (i.id && i.id.toLowerCase().includes(q)) ||
          (i.make && i.make.toLowerCase().includes(q)) ||
          (i.model && i.model.toLowerCase().includes(q)) ||
          (i.serial1 && i.serial1.toLowerCase().includes(q))
      );
    }

    // sort
    list.sort((a, b) => {
      if (sortBy === "name") return (a.name || "").localeCompare(b.name || "");
      if (sortBy === "lastSeen") {
        const da = a.lastSeen ? new Date(a.lastSeen) : null;
        const db = b.lastSeen ? new Date(b.lastSeen) : null;
        if (da && db) return db - da;
        if (da && !db) return -1;
        if (!da && db) return 1;
        return 0;
      }
      if (sortBy === "status") return (a.status || "").localeCompare(b.status || "");
      return 0;
    });

    return list;
  }, [items, statusFilter, categoryFilter, query, sortBy]);

  useEffect(() => {
  setPage(1);
}, [query, statusFilter, categoryFilter, sortBy]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  useEffect(() => {
    setPage((p) => (p > totalPages ? totalPages : p));
  }, [totalPages]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * perPage;
    return filtered.slice(start, start + perPage);
  }, [filtered, page]);

  const stats = useMemo(() => {
    const totalItems = items.length;
    const activeItems = items.filter((i) => i.status === "Active").length;
    const stolenItems = items.filter((i) => i.status === "Stolen").length;
    return { totalItems, activeItems, stolenItems };
  }, [items]);

  // context-backed actions (wrappers)
  function doToggleStatus(id) {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    const next = it.status === "Stolen" ? "Active" : "Stolen";
    updateItem(id, { status: next });
    // Note: toast shown via afterConfirmMessage handled by modal -> handleAfterConfirm
  }

  function doDelete(id) {
    deleteItem(id);
    // Note: toast shown via afterConfirmMessage handled by modal -> handleAfterConfirm
  }

  // wrappers that open the confirm modal with action + message
  function confirmToggleStatus(id) {
    const it = items.find((x) => x.id === id);
    if (!it) return;
    const next = it.status === "Stolen" ? "Active" : "Stolen";

    openConfirm({
      title: "Change status",
      message: `Are you sure you want to mark "${it.name || it.id}" as ${next}?`,
      confirmLabel: next === "Stolen" ? "Mark Stolen" : "Mark Active",
      cancelLabel: "Cancel",
      danger: next === "Stolen",
      action: doToggleStatus,
      arg: id,
      afterConfirmMessage: `${it.name || it.id} marked ${next}`,
    });
  }

  function confirmDelete(id) {
    const it = items.find((x) => x.id === id);
    if (!it) return;

    openConfirm({
      title: "Delete item",
      message: `Delete "${it.name || it.id}"? This action cannot be undone.`,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      danger: true,
      action: doDelete,
      arg: id,
      afterConfirmMessage: `${it.name || it.id} deleted`,
    });
  }

  function handleExportCSV() {
    const rows = [
      [
        "ID",
        "Name",
        "Category",
        "Make",
        "Model",
        "Status",
        "LastSeen",
        "Location",
        "Serial1",
        "CreatedOn",
        "UpdatedOn",
      ],
      ...filtered.map((i) => [
        i.id,
        i.name,
        i.category || "",
        i.make || "",
        i.model || "",
        i.status || "",
        i.lastSeen || "",
        i.location || "",
        i.serial1 || "",
        i.createdOn || "",
        i.updatedOn || "",
      ]),
    ];

    const escapeCell = (cell) => {
      const s = String(cell == null ? "" : cell);
      const escaped = s.replace(/"/g, '""');
      return '"' + escaped + '"';
    };

    const csv = rows.map((row) => row.map(escapeCell).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ireg_items_export_" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function statusBadge(status) {
    if (status === "Stolen")
      return "bg-red-100 text-red-700 border border-red-200";
    if (status === "Active")
      return "bg-emerald-100 text-emerald-700 border border-emerald-200";
    return "bg-gray-100 text-gray-600 border border-gray-200";
  }

  const startIndex = total === 0 ? 0 : (page - 1) * perPage + 1;
  const endIndex = Math.min(page * perPage, total);

  return (
    <div className="min-h-screen bg-gray-100">

      {/* Confirm modal wired to call action(actionArg) and run afterConfirm */}
      <ConfirmModal
        isOpen={confirm.isOpen}
        onClose={() => closeConfirm()}
        action={confirm.action}
        actionArg={confirm.arg}
        afterConfirm={() => handleAfterConfirm()}
        title={confirm.title}
        message={confirm.message}
        confirmLabel={confirm.confirmLabel}
        cancelLabel={confirm.cancelLabel}
        danger={confirm.danger}
      />

      {/* Toast */}
      <Toast
        message={toast.message}
        type={toast.type}
        visible={toast.visible}
        onClose={() => setToast({ message: "", type: "info", visible: false })}
      />

      <div className="p-4 sm:p-6 max-w-6xl mx-auto">
        {/* top row: title + actions */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-2xl font-bold text-iregistrygreen">My Items</h1>
            <p className="text-sm text-gray-500">View and manage your registered items</p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="hidden sm:flex items-center gap-2">
              <div className="text-xs text-gray-500 mr-2">Sort by</div>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setPage(1);
                }}
                className="border rounded-lg px-3 py-2"
              >
                <option value="name">Name</option>
                <option value="lastSeen">Last Seen</option>
                <option value="status">Status</option>
              </select>
            </div>

            <RippleButton
              className="py-2 px-3 rounded-lg bg-iregistrygreen text-white text-sm"
              onClick={() => navigate("/items/add")}
            >
              + Add Item
            </RippleButton>

            <RippleButton
              className="py-2 px-3 rounded-lg bg-gray-100 text-gray-800 text-sm"
              onClick={handleExportCSV}
            >
              Export CSV
            </RippleButton>
          </div>
        </div>

        {/* filters row */}
        <div className="bg-white p-5 rounded-2xl shadow-sm mb-6 border border-gray-100">
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            <div className="flex-1">
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by name, id, make, model or serial..."
                className="w-full border rounded-lg px-4 py-2"
              />
            </div>

            <div className="flex gap-3 items-center">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="border rounded-lg px-3 py-2"
              >
                <option value="All">All statuses</option>
                <option value="Active">Active</option>
                <option value="Stolen">Stolen</option>
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
                className="border rounded-lg px-3 py-2"
              >
                <option value="All">All categories</option>
                {categories.map((c) => (
                  <option value={c} key={c}>
                    {c}
                  </option>
                ))}
              </select>

              <div className="text-sm text-gray-600">
                <strong>{stats.totalItems}</strong> total ·{" "}
                <span className="text-iregistrygreen font-semibold">{stats.activeItems}</span> active ·{" "}
                <span className="text-red-600 font-semibold">{stats.stolenItems}</span> stolen
              </div>
            </div>
          </div>
        </div>

        {/* table (desktop) */}
        <div className="hidden sm:block bg-white rounded-2xl shadow-sm overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-gray-500 text-xs uppercase">
              <tr>
                <th className="text-left py-3 px-4">Item</th>
                <th className="text-left py-3 px-4">Category</th>
                <th className="text-left py-3 px-4">Status</th>
                <th className="text-left py-3 px-4">Last Seen</th>
                <th className="text-left py-3 px-4">Location</th>
                <th className="text-right py-3 px-4">Est.Value</th>
                <th className="text-right py-3 px-4">Actions</th>
              </tr>
            </thead>

            <tbody>
              {/* ================= LOADING SKELETON ================= */}
              {loading &&
                [...Array(perPage)].map((_, i) => (
                  <tr key={i} className="border-t animate-pulse">
                    <td className="py-3 px-4">
                      <div className="h-4 bg-gray-200 rounded w-32" />
                    </td>
                    <td className="py-3 px-4">
                      <div className="h-4 bg-gray-200 rounded w-40" />
                    </td>
                    <td className="py-3 px-4">
                      <div className="h-4 bg-gray-200 rounded w-24" />
                    </td>
                    <td className="py-3 px-4">
                      <div className="h-6 bg-gray-200 rounded-full w-20" />
                    </td>
                    <td className="py-3 px-4">
                      <div className="h-4 bg-gray-200 rounded w-28" />
                    </td>
                    <td className="py-3 px-4">
                      <div className="h-4 bg-gray-200 rounded w-28" />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="h-6 bg-gray-200 rounded w-24 ml-auto" />
                    </td>
                  </tr>
                ))}

              {/* ================= DATA ROWS ================= */}
              {!loading &&
                pageItems.map((item) => {
                  const statusClass =
                    item.status === "Stolen"
                      ? "bg-red-600 text-white"
                      : "bg-iregistrygreen text-white";

                  const toggleLabel =
                    item.status === "Stolen" ? "Mark Active" : "Mark Stolen";

                  return (
                    <tr key={item.id} className="border-t hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {/* Thumbnail */}
                          <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-xs text-gray-400 overflow-hidden">
                            {item.photos?.[0] ? (
                              <img
                                src={item.photos[0]}
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              "—"
                            )}
                          </div>

                          {/* Name + Serial */}
                          <div>
                            <div className="font-semibold text-gray-900 hover:text-iregistrygreen cursor-pointer"
                                onClick={() => navigate("/items/" + item.slug)}>
                              {item.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              Serial: {item.serial1 || "—"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-600">{item.category}</td>
                      <td className="py-3 px-4">
                        <span
                          className={
                            "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border " +
                            statusBadge(item.status)
                          }
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {item.lastSeen || "-"}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {item.location || "-"}
                      </td>
                      <td className="py-3 px-4 text-right font-medium text-gray-700">
                        {formatCurrency(item.estimatedValue)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <RippleButton
                            className="px-3 py-1 rounded-md bg-gray-100 text-gray-700 text-xs"
                            onClick={() => navigate("/items/" + item.slug)}
                          >
                            View
                          </RippleButton>

                          <RippleButton
                            className={"px-3 py-1 rounded-md text-xs " + statusClass}
                            onClick={() => confirmToggleStatus(item.id)}
                          >
                            {toggleLabel}
                          </RippleButton>

                          <RippleButton
                            className="px-2 py-1 rounded-md bg-white text-red-600 border border-red-100 text-xs"
                            onClick={() => confirmDelete(item.id)}
                          >
                            Delete
                          </RippleButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}

              {/* ================= EMPTY STATE ================= */}
              {!loading && pageItems.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="py-6 px-4 text-center text-gray-500"
                  >
                    No items found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* mobile cards */}
        <div className="sm:hidden space-y-3">
          {pageItems.map((item) => {
            const statusClass =
              item.status === "Stolen" ? "bg-red-600 text-white" : "bg-iregistrygreen text-white";
            const toggleLabel = item.status === "Stolen" ? "Mark Active" : "Mark Stolen";

            return (
              <div key={item.id} className="bg-white border rounded-xl px-3 py-3 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-gray-900">{item.name}</p>
                    <p className="text-xs text-gray-500">ID: {item.id}</p>
                    <p className="text-xs text-gray-500">Category: {item.category}</p>
                    {item.estimatedValue != null && (
                    <p className="text-xs text-gray-500">
                      Value: <span className="font-medium text-gray-700">
                        {formatCurrency(item.estimatedValue)}
                      </span>
                    </p>
                  )}
                  </div>

                  <div className="text-right">
                    <span
                      className={
                        "inline-flex px-2 py-1 rounded-full text-xs font-medium " + statusBadge(item.status)
                      }
                    >
                      {item.status}
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <RippleButton
                    className="flex-1 py-2 rounded-lg bg-gray-100 text-sm text-gray-800"
                    onClick={() => navigate("/items/" + item.slug)}
                  >
                    View
                  </RippleButton>

                  <RippleButton
                    className={"flex-1 py-2 rounded-lg text-sm " + statusClass}
                    onClick={() => confirmToggleStatus(item.id)}
                  >
                    {toggleLabel}
                  </RippleButton>
                </div>
              </div>
            );
          })}
          {pageItems.length === 0 && (
            <div className="text-center py-6 px-4 text-gray-500 bg-white rounded-lg shadow-sm">No items found.</div>
          )}
        </div>

        {/* pagination */}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing <strong>{startIndex}</strong> - <strong>{endIndex}</strong> of <strong>{total}</strong>
          </div>

          <div className="flex items-center gap-2">
            <RippleButton
              className="px-3 py-1 rounded-md bg-white border"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </RippleButton>

            <div className="px-3 py-1 rounded-md bg-white border text-sm">
              {page} / {totalPages}
            </div>

            <RippleButton
              className="px-3 py-1 rounded-md bg-white border"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
            </RippleButton>
          </div>
        </div>
      </div>
    </div>
  );
}