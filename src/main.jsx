// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ModalProvider } from "./contexts/ModalContext";
import "./index.css";

// PUBLIC
import HomePage from "./Pages/HomePage.jsx";
import Unauthorized from "./Pages/Unauthorized.jsx";

// ITEMS
import AddItem from "./Pages/AddItem.jsx";
import Items from "./Pages/Items.jsx";
import ItemDetails from "./Pages/ItemDetails.jsx";
import EditItem from "./Pages/EditItem.jsx";

// AUTH / ROUTING
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import RoleRedirect from "./components/RoleRedirect.jsx";
import AppLayout from "./Layouts/AppLayout.jsx";

// DASHBOARDS
import UserDashboard from "./Pages/UserDashboard.jsx";
import UserLayout from "./Pages/user/UserLayout.jsx";
import UserItemsPage from "./Pages/user/UserItemsPage.jsx";
import UserDeletedItemsPage from "./Pages/user/UserDeletedItemsPage.jsx";
import UserLegacyItemsPage from "./Pages/user/UserLegacyItemsPage.jsx";
import UserNotificationsPage from "./Pages/user/UserNotificationsPage.jsx";
import UserActivityPage from "./Pages/user/UserActivityPage.jsx";
import UserTransactionsPage from "./Pages/user/UserTransactionsPage.jsx";
import UserPricingPage from "./Pages/user/UserPricingPage.jsx";
import UserTopupPage from "./Pages/user/UserTopupPage.jsx";
import UserManualPage from "./Pages/user/UserManualPage.jsx";
import UserOrganizationsPage from "./Pages/user/UserOrganizationsPage.jsx";
import FaqPage from "./Pages/FaqPage.jsx";
import TermsPage from "./Pages/TermsPage.jsx";
import AdminLayout from "./Pages/admin/AdminLayout.jsx";
import AdminHome from "./Pages/admin/AdminHome.jsx";
import AdminTransfersPage from "./Pages/admin/AdminTransfersPage.jsx";
import AdminUsers from "./Pages/admin/AdminUsers.jsx";
import AdminAuditLogs from "./Pages/admin/AdminAuditLogs.jsx";
import AdminSettings from "./Pages/admin/AdminSettings.jsx";
import AdminItemsPage from "./Pages/admin/AdminItemsPage.jsx";
import AdminDeletedItemsPage from "./Pages/admin/AdminDeletedItemsPage.jsx";
import AdminLegacyItemsPage from "./Pages/admin/AdminLegacyItemsPage.jsx";
import AdminNotificationsPage from "./Pages/admin/AdminNotificationsPage.jsx";
import AdminActivityPage from "./Pages/admin/AdminActivityPage.jsx";
import AdminSessionsPage from "./Pages/admin/AdminSessionsPage.jsx";
import AdminTopupPage from "./Pages/admin/AdminTopupPage.jsx";
import AdminTransactionsPage from "./Pages/admin/AdminTransactionsPage.jsx";
import AdminPricingPage from "./Pages/admin/AdminPricingPage.jsx";
import AdminRevenuePage from "./Pages/admin/AdminRevenuePage.jsx";
import AdminPackagesPage from "./Pages/admin/AdminPackagesPage.jsx";
import PoliceLayout from "./Pages/police/PoliceLayout.jsx";
import PoliceHome from "./Pages/police/PoliceHome.jsx";
import PoliceItemsPage from "./Pages/police/PoliceItemsPage.jsx";
import PoliceDeletedItemsPage from "./Pages/police/PoliceDeletedItemsPage.jsx";
import PoliceLegacyItemsPage from "./Pages/police/PoliceLegacyItemsPage.jsx";
import PoliceNotificationsPage from "./Pages/police/PoliceNotificationsPage.jsx";
import PoliceActivityPage from "./Pages/police/PoliceActivityPage.jsx";
import PolicePricingPage from "./Pages/police/PolicePricingPage.jsx";
import PoliceTopupPage from "./Pages/police/PoliceTopupPage.jsx";
import PoliceImpoundPage from "./Pages/police/PoliceImpoundPage.jsx";
import CashierLayout from "./Pages/cashier/CashierLayout.jsx";
import CashierHome from "./Pages/cashier/CashierHome.jsx";
import CashierItemsPage from "./Pages/cashier/CashierItemsPage.jsx";
import CashierDeletedItemsPage from "./Pages/cashier/CashierDeletedItemsPage.jsx";
import CashierLegacyItemsPage from "./Pages/cashier/CashierLegacyItemsPage.jsx";
import CashierNotificationsPage from "./Pages/cashier/CashierNotificationsPage.jsx";
import CashierActivityPage from "./Pages/cashier/CashierActivityPage.jsx";
import CashierTopupPage from "./Pages/cashier/CashierTopupPage.jsx";
import CashierTransactionsPage from "./Pages/cashier/CashierTransactionsPage.jsx";
import CashierPricingPage from "./Pages/cashier/CashierPricingPage.jsx";
import CashierRevenuePage from "./Pages/cashier/CashierRevenuePage.jsx";
import CashierUsersPage from "./Pages/cashier/CashierUsersPage.jsx";
import OrganizationItemsPage from "./Pages/shared/OrganizationItemsPage.jsx";
import OrganizationWalletPage from "./Pages/shared/OrganizationWalletPage.jsx";
import OrganizationTransactionsPage from "./Pages/shared/OrganizationTransactionsPage.jsx";
import OrganizationMembersPage from "./Pages/shared/OrganizationMembersPage.jsx";
import StaffOrgTransferRequestsPage from "./Pages/shared/StaffOrgTransferRequestsPage.jsx";
import StaffOrganizationsPage from "./Pages/shared/StaffOrganizationsPage.jsx";
import StaffAddOrgMemberPage from "./Pages/shared/StaffAddOrgMemberPage.jsx";
import StaffOrganizationMembersPage from "./Pages/shared/StaffOrganizationMembersPage.jsx";

// AUTH PAGES
import Login from "./Pages/Login.jsx";
import Signup from "./Pages/Signup.jsx";

import Notifications from "./Pages/NotificationsPage.jsx";
import Activity from "./Pages/ActivityPage.jsx";
import ProfilePage from "./Pages/ProfilePage.jsx";
import ProfileRoleRedirect from "./components/ProfileRoleRedirect.jsx";

// CONTEXTS
import { ItemsProvider } from "./contexts/ItemsContext.jsx";
import { ToastProvider } from "./contexts/ToastContext.jsx";
import { AuthProvider } from "./contexts/AuthContext.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <ItemsProvider>
        <ToastProvider>
          <ModalProvider>
            <BrowserRouter>
              <Routes>

                <Route element={<AppLayout />}>

                  {/* Public */}
                  <Route path="/" element={<HomePage />} />
                  <Route path="/unauthorized" element={<Unauthorized />} />
                  <Route path="/guide" element={<UserManualPage />} />
                  <Route path="/faq" element={<FaqPage />} />
                  <Route path="/terms" element={<TermsPage />} />
                  <Route
                    path="/userdashboard/manual"
                    element={<Navigate to="/guide" replace />}
                  />
                  <Route
                    path="/user/manual"
                    element={<Navigate to="/guide" replace />}
                  />

                  <Route path="/redirect" element={<RoleRedirect />} />

                  {/* Auth */}
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />

                  {/* Dashboards */}
                  <Route
                    path="/user"
                    element={
                      <ProtectedRoute allowedRoles={["user", "admin", "police"]}>
                        <UserLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<UserDashboard />} />
                    <Route path="profile" element={<ProfilePage />} />
                    <Route path="items" element={<UserItemsPage />} />
                    <Route path="items/deleted" element={<UserDeletedItemsPage />} />
                    <Route path="items/legacy" element={<UserLegacyItemsPage />} />
                    <Route path="notifications" element={<UserNotificationsPage />} />
                    <Route path="activity" element={<UserActivityPage />} />
                    <Route path="transactions" element={<UserTransactionsPage />} />
                    <Route path="organizations" element={<UserOrganizationsPage />} />
                    <Route path="pricing" element={<UserPricingPage />} />
                    <Route path="topup" element={<UserTopupPage />} />
                  </Route>

                  <Route
                    path="/admin"
                    element={
                      <ProtectedRoute allowedRoles={["admin"]}>
                        <AdminLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<AdminHome />} />
                    <Route path="profile" element={<ProfilePage />} />
                    <Route path="users" element={<AdminUsers />} />
                    <Route path="audit-logs" element={<AdminAuditLogs />} />
                    <Route path="settings" element={<AdminSettings />} />
                    <Route path="topup" element={<AdminTopupPage />} />
                    <Route path="transactions" element={<AdminTransactionsPage />} />
                    <Route path="pricing" element={<AdminPricingPage />} />
                    <Route path="packages" element={<AdminPackagesPage />} />
                    <Route path="revenue" element={<AdminRevenuePage />} />
                    <Route path="items" element={<AdminItemsPage />} />
                    <Route path="items/deleted" element={<AdminDeletedItemsPage />} />
                    <Route path="items/legacy" element={<AdminLegacyItemsPage />} />
                    <Route path="notifications" element={<AdminNotificationsPage />} />
                    <Route path="activity" element={<AdminActivityPage />} />
                    <Route path="sessions" element={<AdminSessionsPage />} />
                    <Route path="transfers" element={<AdminTransfersPage />} />
                    <Route
                      path="org-transfer-requests"
                      element={<Navigate to="/admin/transfers?view=organization" replace />}
                    />
                    <Route
                      path="organizations"
                      element={
                        <StaffOrganizationsPage
                          title="Organizations"
                          subtitle="Browse organizations and jump to items, wallet, or transactions."
                        />
                      }
                    />
                    <Route
                      path="organizations/:orgId/add-member"
                      element={<StaffAddOrgMemberPage staffBasePath="/admin" />}
                    />
                    <Route
                      path="organizations/:orgId/members"
                      element={<StaffOrganizationMembersPage staffBasePath="/admin" />}
                    />
                  </Route>

                  <Route
                    path="/police"
                    element={
                      <ProtectedRoute allowedRoles={["police", "admin"]}>
                        <PoliceLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<PoliceHome />} />
                    <Route path="profile" element={<ProfilePage />} />
                    <Route path="items" element={<PoliceItemsPage />} />
                    <Route path="items/deleted" element={<PoliceDeletedItemsPage />} />
                    <Route path="items/legacy" element={<PoliceLegacyItemsPage />} />
                    <Route path="impound" element={<PoliceImpoundPage />} />
                    <Route path="notifications" element={<PoliceNotificationsPage />} />
                    <Route path="activity" element={<PoliceActivityPage />} />
                    <Route path="topup" element={<PoliceTopupPage />} />
                    <Route path="pricing" element={<PolicePricingPage />} />
                  </Route>

                  <Route
                    path="/cashier"
                    element={
                      <ProtectedRoute allowedRoles={["cashier"]}>
                        <CashierLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<CashierHome />} />
                    <Route path="profile" element={<ProfilePage />} />
                    <Route path="items" element={<CashierItemsPage />} />
                    <Route path="items/deleted" element={<CashierDeletedItemsPage />} />
                    <Route path="items/legacy" element={<CashierLegacyItemsPage />} />
                    <Route path="users" element={<CashierUsersPage />} />
                    <Route path="topup" element={<CashierTopupPage />} />
                    <Route path="transactions" element={<CashierTransactionsPage />} />
                    <Route path="pricing" element={<CashierPricingPage />} />
                    <Route path="revenue" element={<CashierRevenuePage />} />
                    <Route path="notifications" element={<CashierNotificationsPage />} />
                    <Route path="activity" element={<CashierActivityPage />} />
                    <Route
                      path="organizations"
                      element={
                        <StaffOrganizationsPage
                          title="Organizations"
                          subtitle="Browse organizations and jump to items, wallet, or transactions."
                        />
                      }
                    />
                    <Route
                      path="organizations/:orgId/add-member"
                      element={<StaffAddOrgMemberPage staffBasePath="/cashier" />}
                    />
                    <Route
                      path="organizations/:orgId/members"
                      element={<StaffOrganizationMembersPage staffBasePath="/cashier" />}
                    />
                    <Route
                      path="org-transfer-requests"
                      element={<StaffOrgTransferRequestsPage />}
                    />
                  </Route>

                  {/* Backward-compatible redirects (old dashboard URLs) */}
                  <Route path="/userdashboard" element={<Navigate to="/user" replace />} />
                  <Route path="/userdashboard/*" element={<Navigate to="/user" replace />} />
                  <Route path="/admindashboard" element={<Navigate to="/admin" replace />} />
                  <Route path="/admindashboard/*" element={<Navigate to="/admin" replace />} />
                  <Route path="/policedashboard" element={<Navigate to="/police" replace />} />
                  <Route path="/policedashboard/*" element={<Navigate to="/police" replace />} />
                  <Route path="/cashierdashboard" element={<Navigate to="/cashier" replace />} />
                  <Route path="/cashierdashboard/*" element={<Navigate to="/cashier" replace />} />

                  {/* Items */}
                  <Route
                    path="/items"
                    element={
                      <ProtectedRoute allowedRoles={["user", "admin", "police", "cashier"]}>
                        <Items />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="/items/add"
                    element={
                      <ProtectedRoute allowedRoles={["user", "admin", "police", "cashier"]}>
                        <AddItem />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="/items/:slug"
                    element={
                      <ProtectedRoute allowedRoles={["user", "admin", "police", "cashier"]}>
                        <ItemDetails />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="/items/:id/edit"
                    element={
                      <ProtectedRoute allowedRoles={["user", "admin", "police", "cashier"]}>
                        <EditItem />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="/items/:slug/edit"
                    element={
                      <ProtectedRoute allowedRoles={["user", "admin", "police", "cashier"]}>
                        <EditItem />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="/notifications"
                    element={
                      <ProtectedRoute allowedRoles={["user", "admin", "police", "cashier"]}>
                        <Notifications />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="/activity"
                    element={
                      <ProtectedRoute allowedRoles={["user", "admin", "police", "cashier"]}>
                        <Activity />
                      </ProtectedRoute>
                    }
                  />

                  <Route path="/profile" element={<ProfileRoleRedirect />} />

                  {/* Organization-owned items (shared) */}
                  <Route
                    path="/organizations/:orgId/items"
                    element={
                      <ProtectedRoute allowedRoles={["user", "admin", "police", "cashier"]}>
                        <OrganizationItemsPage />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="/organizations/:orgId/wallet"
                    element={
                      <ProtectedRoute allowedRoles={["user", "admin", "police", "cashier"]}>
                        <OrganizationWalletPage />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="/organizations/:orgId/transactions"
                    element={
                      <ProtectedRoute allowedRoles={["user", "admin", "police", "cashier"]}>
                        <OrganizationTransactionsPage />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="/organizations/:orgId/members"
                    element={
                      <ProtectedRoute allowedRoles={["user", "admin", "police", "cashier"]}>
                        <OrganizationMembersPage />
                      </ProtectedRoute>
                    }
                  />

                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />

              </Routes>
            </BrowserRouter>
          </ModalProvider>
        </ToastProvider>
      </ItemsProvider>
    </AuthProvider>
  </React.StrictMode>
);