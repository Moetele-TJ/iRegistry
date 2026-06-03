/**

 * Single source of truth for navigation, page titles, and human-readable UI labels.

 *

 * Title case for menus and display text. **Do not** use these strings as API/DB

 * enum values unless the constant name says otherwise.

 *

 * Case sensitivity:

 * - `value` / `key` fields in option lists must match backend expectations exactly

 *   (e.g. user status `"active"`, transfer `"OPEN"`, item filter `"Active"`).

 * - `label` text comes from this module and can use title case freely.

 */



/** Core sidebar and header destinations (shared across roles where applicable). */

export const NAV = Object.freeze({

  dashboard: "Dashboard",

  profile: "Profile",

  items: "Items",

  activeItems: "Active Items",

  deletedItems: "Deleted Items",

  legacyItems: "Legacy Items",

  notifications: "Notifications",

  activity: "Activity",

  transactions: "Transactions",

  organizations: "Organizations",

  users: "Users",

  activeUsers: "Active Users",

  nonActiveUsers: "Non-Active Users",

  pricing: "Pricing",

  packages: "Packages",

  revenue: "Revenue",

  topUp: "Top Up",

  topUpRequests: "Top Up Requests",

  wallet: "Wallet",

  members: "Members",

  settings: "Settings",

  sessions: "Sessions",

  transfers: "Transfers",

  auditLogs: "Audit Logs",

  smsOtpUsage: "SMS OTP Usage",

  recentLogins: "Recent Logins",

  orgTransferRequests: "Org Transfer Requests",

  impoundFoundItem: "Impound / Found Item",

});



/** Police items submenu (station queue + personal registry views). */

export const NAV_POLICE_ITEMS = Object.freeze({

  stationStolenQueue: "Station Stolen Queue",

  myActiveItems: "My Active Items",

  myDeletedItems: "My Deleted Items",

  myLegacyItems: "My Legacy Items",

});



/** Leave-organization sidebar link back to app role home. */

export const NAV_APP_HOME = Object.freeze({

  admin: "Admin Home",

  cashier: "Cashier Home",

  police: "Police Home",

  user: "User Home",

});



/** Header / auth chrome. */

export const NAV_HEADER = Object.freeze({

  home: "Home",

  signUp: "Sign Up",

  login: "Login",

  logout: "Logout",

  workspaces: "Workspaces",

  user: "User",

  cashier: "Cashier",

  police: "Police",

  admin: "Admin",

});



/** Bottom nav and dashboard quick panels. */

export const NAV_MOBILE = Object.freeze({

  myItems: "My Items",

  addItem: "Add Item",

});



/** Staff shortcuts, row actions, and CTAs. */

export const NAV_ACTIONS = Object.freeze({

  manageUsers: "Manage Users",

  addUser: "Add User",

  editUser: "Edit User",

  addItem: "Add Item",

  addItemForUser: "Add Item for User",

  viewItems: "View Items",

  viewMyItems: "View My Items",

  topUp: "Top Up",

  topUpCredits: "Top Up Credits",

  topUpWallet: "Top Up Wallet",

  transactions: "Transactions",

  registerItem: "Register Item",

  registerNewItem: "Register New Item",

  addYourFirstItem: "Add Your First Item",

  reportTheft: "Report Theft",

  quickActions: "Quick Actions",

  backToUsers: "Back to Users",

  accountActions: "Account",

});



/** Page / section card titles. */

export const PAGE_TITLES = Object.freeze({

  auditLogs: "Audit Logs",

  recentLogins: "Recent Logins",

  smsLoginOtpUsage: "SMS Login OTP Usage",

  userTopUpCredits: "Top Up Credits",

  cashierTopUp: "Cashier Top Up",

  impoundRegisterFoundItem: "Impound / Register Found Item",

  organizationWallet: "Organization Wallet",

  organizationTransactions: "Organization Transactions",

  organizationMembers: "Organization Members",

  organizationTransferRequests: "Organization Transfer Requests",

});



/**

 * Human-readable labels keyed by the **case-sensitive** codes the app already uses.

 * Keys must match deriveUserStatus, getItemDerivedState, transfer status enums, etc.

 */

export const DISPLAY = Object.freeze({

  all: "All",

  allStatuses: "All Statuses",

  /** Matches getItemDerivedState() return values (PascalCase). */

  itemStatus: Object.freeze({

    Active: "Active",

    Stolen: "Stolen",

    Legacy: "Legacy",

    Deleted: "Deleted",

  }),

  /** Matches deriveUserStatus() return values (lowercase). */

  userAccountStatus: Object.freeze({

    active: "Active",

    suspended: "Suspended",

    disabled: "Disabled",

    deleted: "Deleted",

  }),

  /** Matches org transfer request status enum (uppercase). */

  transferRequestStatus: Object.freeze({

    OPEN: "Open",

    COMPLETED: "Completed",

    REJECTED: "Rejected",

    CANCELLED: "Cancelled",

  }),

  /** App role codes (lowercase) → display label. */

  appRole: Object.freeze({

    user: "User",

    police: "Police",

    cashier: "Cashier",

    admin: "Admin",

  }),

  stats: Object.freeze({

    totalUsers: "Total Users",

    activeUsers: "Active Users",

    usersWithoutItems: "Users without Items",

    registeredItems: "Registered Items",

    stolenItems: "Stolen Items",

  }),

});



/**

 * Select options: `value` is case-sensitive (API/filter); `label` is display-only.

 */



/** User list filter — values match deriveUserStatus(). */

export const USER_ACCOUNT_STATUS_FILTER_OPTIONS = Object.freeze([

  { value: "all", label: DISPLAY.all },

  { value: "active", label: DISPLAY.userAccountStatus.active },

  { value: "suspended", label: DISPLAY.userAccountStatus.suspended },

  { value: "disabled", label: DISPLAY.userAccountStatus.disabled },

]);



/** Non-active users list — values match deriveUserStatus(). */

export const USER_ACCOUNT_NON_ACTIVE_FILTER_OPTIONS = Object.freeze([

  { value: "all", label: DISPLAY.all },

  { value: "suspended", label: DISPLAY.userAccountStatus.suspended },

  { value: "disabled", label: DISPLAY.userAccountStatus.disabled },

  { value: "deleted", label: DISPLAY.userAccountStatus.deleted },

]);



/** User create/edit form — values match update-user / create-user status field. */

export const USER_ACCOUNT_STATUS_FORM_OPTIONS = Object.freeze([

  { value: "active", label: DISPLAY.userAccountStatus.active },

  { value: "suspended", label: DISPLAY.userAccountStatus.suspended },

  { value: "disabled", label: DISPLAY.userAccountStatus.disabled },

]);



/** Items list filter — values match getItemDerivedState(); "All" is the filter sentinel. */

export const ITEM_STATUS_FILTER_OPTIONS = Object.freeze([

  { value: "All", label: DISPLAY.allStatuses },

  { value: "Active", label: DISPLAY.itemStatus.Active },

  { value: "Stolen", label: DISPLAY.itemStatus.Stolen },

]);



/** Staff org transfer requests — values match API status enum. */

export const TRANSFER_REQUEST_STATUS_FILTER_OPTIONS = Object.freeze([

  { value: "OPEN", label: DISPLAY.transferRequestStatus.OPEN },

  { value: "COMPLETED", label: DISPLAY.transferRequestStatus.COMPLETED },

  { value: "REJECTED", label: DISPLAY.transferRequestStatus.REJECTED },

  { value: "CANCELLED", label: DISPLAY.transferRequestStatus.CANCELLED },

]);



/** Role dropdown — values match users.role (lowercase). */

export const APP_ROLE_OPTIONS = Object.freeze([

  { value: "user", label: DISPLAY.appRole.user },

  { value: "police", label: DISPLAY.appRole.police },

  { value: "cashier", label: DISPLAY.appRole.cashier },

  { value: "admin", label: DISPLAY.appRole.admin },

]);



/** Prefix helpers for button labels. */

export function addItemButtonLabel(forUser = false) {

  return forUser ? `+ ${NAV_ACTIONS.addItemForUser}` : `+ ${NAV_ACTIONS.addItem}`;

}



export function addItemAriaLabel(displayName) {

  const who = displayName ? String(displayName).trim() : "user";

  return `${NAV_ACTIONS.addItem} for ${who}`;

}



/** App role → home route label (organization sidebar). */

export function appHomeLabelForRole(role) {

  const r = String(role || "user").toLowerCase();

  if (r === "admin") return NAV_APP_HOME.admin;

  if (r === "cashier") return NAV_APP_HOME.cashier;

  if (r === "police") return NAV_APP_HOME.police;

  return NAV_APP_HOME.user;

}



/** App role → home path (organization sidebar). */

export function appHomePathForRole(role) {

  const r = String(role || "user").toLowerCase();

  if (r === "admin") return "/admin";

  if (r === "cashier") return "/cashier";

  if (r === "police") return "/police";

  return "/user";

}



/** Display label for a user account status code (deriveUserStatus). */

export function userAccountStatusLabel(code) {

  const k = String(code ?? "").toLowerCase();

  return DISPLAY.userAccountStatus[k] ?? code ?? "";

}



/** Display label for an item derived state (getItemDerivedState). */

export function itemStatusLabel(code) {

  const k = String(code ?? "");

  return DISPLAY.itemStatus[k] ?? code ?? "";

}


