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
        {/* ===== Page Header ===== */}
        <div className="mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            
            {/* Left: Title + description */}
            <div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
                My Items
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Manage and monitor your registered assets
              </p>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-3">
              <RippleButton
                className="px-4 py-2 rounded-xl bg-iregistrygreen text-white text-sm font-medium shadow-sm hover:shadow-md transition"
                onClick={() => navigate("/items/add")}
              >
                + Add Item
              </RippleButton>

              <RippleButton
                className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition"
                onClick={handleExportCSV}
              >
                Export CSV
              </RippleButton>
            </div>

          </div>
        </div>

        {/* filters row */}
        <div className="bg-white p-5 rounded-2xl shadow-sm mb-6 border border-gray-100">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">

            {/* LEFT SIDE */}
            <div className="flex flex-col gap-3 w-full lg:w-auto">

              {/* Search */}
              <div>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search by name, id, make, model or serial..."
                  className="w-full lg:w-96 border rounded-xl px-4 py-2.5"
                />
              </div>

              {/* 📱 MOBILE TOTALS (authoritative card) */}
              <div className="lg:hidden bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
                <div className="flex justify-between text-sm font-medium">

                  <div className="text-center flex-1">
                    <div className="text-xs text-gray-400 uppercase tracking-wide">
                      Total
                    </div>
                    <div className="text-xl font-bold text-gray-900">
                      {stats.totalItems}
                    </div>
                  </div>

                  <div className="text-center flex-1">
                    <div className="text-xs text-gray-400 uppercase tracking-wide">
                      Active
                    </div>
                    <div className="text-xl font-bold text-emerald-600">
                      {stats.activeItems}
                    </div>
                  </div>

                  <div className="text-center flex-1">
                    <div className="text-xs text-gray-400 uppercase tracking-wide">
                      Stolen
                    </div>
                    <div className="text-xl font-bold text-red-600">
                      {stats.stolenItems}
                    </div>
                  </div>

                </div>
              </div>

              {/* Filters */}
              <div className="flex gap-3 flex-wrap">
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  className="border rounded-xl px-3 py-2"
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
                  className="border rounded-xl px-3 py-2"
                >
                  <option value="All">All categories</option>
                  {categories.map((c) => (
                    <option value={c} key={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 💻 DESKTOP TOTALS */}
            <div className="hidden lg:flex items-center gap-6 text-sm font-medium">
              <div className="text-gray-700">
                <span className="text-2xl font-bold text-gray-900">
                  {stats.totalItems}
                </span>{" "}
                total
              </div>

              <div className="text-emerald-600">
                <span className="text-2xl font-bold">
                  {stats.activeItems}
                </span>{" "}
                active
              </div>

              <div className="text-red-600">
                <span className="text-2xl font-bold">
                  {stats.stolenItems}
                </span>{" "}
                stolen
              </div>
            </div>

          </div>
        </div>

        {/* table (desktop) */}
        <div className="hidden sm:block bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
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
                  
                  return (
                    <tr
                      key={item.id}
                      className="border-t border-gray-100 hover:bg-gray-50 hover:shadow-sm transition-all duration-150"
                    >
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          {/* Thumbnail */}
                          <div className="w-11 h-11 bg-gray-100 rounded-xl border border-gray-200 flex items-center justify-center text-xs text-gray-400 overflow-hidden">
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
                            <div className="font-semibold text-gray-900 hover:text-iregistrygreen transition cursor-pointer"
                                onClick={() => navigate("/items/" + item.slug)}>
                              {item.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              Serial: {item.serial1 || "—"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-5 text-gray-600">{item.category}</td>
                      <td className="py-4 px-5">
                        <span
                          className={
                            "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium " +
                            statusBadge(item.status)
                          }
                        >
                          {item.status || "—"}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-gray-600">
                        {item.lastSeen || "-"}
                      </td>
                      <td className="py-4 px-5 text-gray-600">
                        {item.location || "-"}
                      </td>
                      <td className="py-4 px-5 text-right font-medium text-gray-700">
                        {formatCurrency(item.estimatedValue)}
                      </td>
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <RippleButton
                            className="px-3 py-1 rounded-md bg-gray-100 text-gray-700 text-xs"
                            onClick={() => navigate("/items/" + item.slug)}
                          >
                            View
                          </RippleButton>

                          <RippleButton
                            className={`px-3 py-1 rounded-md text-xs ${
                              item.status === "Stolen"
                                ? "bg-emerald-600 text-white"
                                : "bg-red-600 text-white"
                            }`}
                            onClick={() => confirmToggleStatus(item.id)}
                          >
                            {item.status === "Stolen" ? "Mark Active" : "Mark Stolen"}
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

        {/* ===== Mobile Cards ===== */}
        <div className="sm:hidden space-y-4 active:scale-[0.99] active:shadow-inner">
          {pageItems.map((item) => {
            const isStolen = item.status === "Stolen";
            const isSelected = statusFilter !== "All";

            return (
              <div
                key={item.id}
                className={`
                  relative bg-white rounded-2xl border transition-all duration-200
                  ${isStolen
                    ? "border-red-100 shadow-md hover:shadow-lg bg-red-50/30"
                    : "border-emerald-100 shadow-sd hover:shadow-lg bg-emerald-50/30"}
                  ${isSelected ? "scale-[1.01]" : ""}
                `}
              >
                {/* Left Status Indicator */}
                <div
                  className={`
                    absolute left-0 top-0 h-full w-1.5 rounded-l-2xl
                    ${isStolen ? "bg-red-500" : "bg-emerald-500"}
                  `}
                />

                <div className="p-4">

                  {/* Top Section */}
                  <div className="flex gap-3">
                    
                    {/* Thumbnail */}
                    <div className={`
                      w-16 h-16 rounded-xl overflow-hidden flex-shrink-0
                      ${isStolen
                        ? "ring-1 ring-red-200 bg-red-50"
                        : "ring-1 ring-emerald-200 bg-emerald-50"}
                    `}>
                      {item.photos?.[0] ? (
                        <img
                          src={item.photos[0]}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                          No Image
                        </div>
                      )}
                    </div>

                    {/* Title + Meta */}
                    <div className="flex-1 min-w-0">
                      <div
                        onClick={() => navigate("/items/" + item.slug)}
                        className="font-semibold text-gray-900 truncate cursor-pointer hover:text-iregistrygreen transition"
                      >
                        {item.name}
                      </div>

                      <div className="text-xs text-gray-500 mt-1">
                        {item.category}
                      </div>

                      <div className="text-xs text-gray-400 mt-1 tracking-wide">
                        Serial: {item.serial1 || "—"}
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div>
                      <span
                        className={`
                          inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors duration-300
                          ${isStolen
                            ? "bg-red-100 text-red-700 border-red-200"
                            : "bg-emerald-100 text-emerald-700 border-emerald-200"}
                        `}
                      >
                        {item.status}
                      </span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="my-4 border-t border-gray-100" />

                  {/* Info Grid */}
                  <div className="grid grid-cols-3 gap-x-3 gap-y-3 text-sm">

                    {/* Estimated Value */}
                    <div>
                      <div className="text-[11px] text-gray-400 uppercase tracking-wide">
                        Value
                      </div>
                      <div className="text-gray-900 font-semibold">
                        {formatCurrency(item.estimatedValue)}
                      </div>
                    </div>

                    {/* Location */}
                    <div>
                      <div className="text-[11px] text-gray-400 uppercase tracking-wide">
                        Location
                      </div>
                      <div className="text-gray-700 font-medium truncate">
                        {item.location || "—"}
                      </div>
                    </div>

                    {/* Last Seen */}
                    <div>
                      <div className="text-[11px] text-gray-400 uppercase tracking-wide">
                        Last Seen
                      </div>
                      <div className="text-gray-700 truncate">
                        {item.lastSeen
                          ? new Date(item.lastSeen).toLocaleDateString("en-BW", {
                              day: "2-digit",
                              month: "short",
                            })
                          : item.status === "Stolen"
                            ? "Never"
                            : "—"}
                      </div>
                    </div>

                  </div>

                  {/* Actions */}
                  <div className="mt-4 flex gap-2">
                    <RippleButton
                      className="flex-1 py-2 rounded-xl bg-gray-100 text-sm text-gray-800"
                      onClick={() => navigate("/items/" + item.slug)}
                    >
                      View
                    </RippleButton>

                    <RippleButton
                      className={`flex-1 py-2 rounded-xl text-sm font-medium ${
                        isStolen
                          ? "bg-emerald-600 text-white hover:bg-emerald-700"
                          : "bg-red-600 text-white hover:bg-red-700"
                      }`}
                      onClick={() => confirmToggleStatus(item.id)}
                    >
                      {isStolen ? "Mark Active" : "Mark Stolen"}
                    </RippleButton>
                  </div>
                </div>
              </div>
            );
          })}

          {!loading && pageItems.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center">
              
              <div className="text-4xl mb-3">📦</div>

              <div className="text-lg font-semibold text-gray-800">
                No items found
              </div>

              <p className="text-sm text-gray-500 mt-2">
                Try adjusting your search or filters.
              </p>

              {items.length === 0 && (
                <RippleButton
                  className="mt-4 px-5 py-2 rounded-xl bg-iregistrygreen text-white text-sm font-medium"
                  onClick={() => navigate("/items/add")}
                >
                  + Add Your First Item
                </RippleButton>
              )}
            </div>
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