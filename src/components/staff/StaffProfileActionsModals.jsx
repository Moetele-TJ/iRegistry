import ConfirmModal from "../ConfirmModal.jsx";
import { APP_ROLE_OPTIONS } from "../../lib/navLabels.js";
import { STAFF_SUSPEND_REASONS } from "../../hooks/useStaffProfileUserActions.js";

export default function StaffProfileActionsModals({ actions }) {
  if (!actions) return null;

  const {
    targetUser,
    displayName,
    busy,
    roleModalOpen,
    setRoleModalOpen,
    roleNext,
    setRoleNext,
    submitRoleChange,
    suspendModalOpen,
    setSuspendModalOpen,
    suspendReason,
    setSuspendReason,
    suspendPreset,
    setSuspendPreset,
    submitSuspend,
    suspendVerb,
  } = actions;

  return (
    <>
      <ConfirmModal
        isOpen={roleModalOpen}
        onClose={() => !busy && setRoleModalOpen(false)}
        onConfirm={() => void submitRoleChange()}
        title="Change role"
        message={`Select a new role for ${displayName}.`}
        confirmLabel={busy ? "Saving…" : "Change role"}
        cancelLabel="Cancel"
        variant="warning"
        confirmDisabled={
          busy ||
          !String(roleNext || "").trim() ||
          String(roleNext || "").toLowerCase() === String(targetUser?.role || "").toLowerCase()
        }
      >
        <div>
          <label className="text-xs text-gray-600">Role</label>
          <select
            value={roleNext}
            onChange={(e) => setRoleNext(e.target.value)}
            className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
            disabled={busy}
          >
            {APP_ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </ConfirmModal>

      <ConfirmModal
        isOpen={suspendModalOpen}
        onClose={() => !busy && setSuspendModalOpen(false)}
        onConfirm={() => void submitSuspend()}
        title={`${suspendVerb} user`}
        message={`${suspendVerb} ${displayName}? A reason is required.`}
        confirmLabel={busy ? "Saving…" : suspendVerb}
        cancelLabel="Cancel"
        danger
        confirmDisabled={busy || !String(suspendReason || "").trim()}
      >
        <div className="space-y-2">
          <div>
            <label className="text-xs text-gray-600">Quick reason</label>
            <select
              value={suspendPreset}
              onChange={(e) => {
                const v = e.target.value;
                actions.setSuspendPreset(v);
                if (v && v !== "Other") setSuspendReason(v);
                if (v === "Other") setSuspendReason("");
              }}
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white"
              disabled={busy}
            >
              <option value="">Select…</option>
              {STAFF_SUSPEND_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600">Reason (required)</label>
            <textarea
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm min-h-[88px]"
              placeholder="Explain why this account is being suspended or disabled…"
              disabled={busy}
            />
          </div>
        </div>
      </ConfirmModal>
    </>
  );
}
