/** Maps legacy per-function names to bundled Edge Functions (staff-api / admin-api). */

const STAFF_OPS = new Set([
  "staff-list-org-members",
  "staff-update-org-member-user",
  "staff-lookup-user",
  "staff-list-orgs-summary",
  "staff-create-org-member",
  "staff-complete-org-item-transfer-request",
  "staff-complete-pending-topup",
]);

const ADMIN_OPS = new Set([
  "admin-create-user",
  "admin-sessions",
  "admin-upsert-task",
  "admin-upsert-credit-package",
  "admin-delete-credit-package",
]);

/**
 * @param {string} name Original function name (may include query string, e.g. stats?mode=admin)
 * @param {Record<string, unknown>} options invoke options (body merged with operation)
 * @returns {{ name: string, options: Record<string, unknown> }}
 */
export function resolveBundledInvoke(name, options = {}) {
  const q = name.indexOf("?");
  const baseName = q === -1 ? name : name.slice(0, q);

  const body =
    options.body && typeof options.body === "object" && !Array.isArray(options.body)
      ? { ...options.body }
      : {};

  if (STAFF_OPS.has(baseName)) {
    return {
      name: "staff-api",
      options: { ...options, body: { ...body, operation: baseName } },
    };
  }

  if (ADMIN_OPS.has(baseName)) {
    return {
      name: "admin-api",
      options: { ...options, body: { ...body, operation: baseName } },
    };
  }

  return { name, options };
}
