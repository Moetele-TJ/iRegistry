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
import AdminLayout from "./Pages/admin/AdminLayout.jsx";
import AdminHome from "./Pages/admin/AdminHome.jsx";
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
import PoliceLayout from "./Pages/police/PoliceLayout.jsx";
import PoliceHome from "./Pages/police/PoliceHome.jsx";
import PoliceItemsPage from "./Pages/police/PoliceItemsPage.jsx";
import PoliceDeletedItemsPage from "./Pages/police/PoliceDeletedItemsPage.jsx";
import PoliceLegacyItemsPage from "./Pages/police/PoliceLegacyItemsPage.jsx";
import PoliceNotificationsPage from "./Pages/police/PoliceNotificationsPage.jsx";
import PoliceActivityPage from "./Pages/police/PoliceActivityPage.jsx";
import PolicePricingPage from "./Pages/police/PolicePricingPage.jsx";
import PoliceTopupPage from "./Pages/police/PoliceTopupPage.jsx";
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

                  <Route path="/redirect" element={<RoleRedirect />} />

                  {/* Auth */}
                  <Route path="/login" element={<Login />} />
                  <Route path="/signup" element={<Signup />} />

                  {/* Dashboards */}
                  <Route
                    path="/userdashboard"
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
                    <Route path="pricing" element={<UserPricingPage />} />
                    <Route path="topup" element={<UserTopupPage />} />
                  </Route>

                  <Route
                    path="/admindashboard"
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
                  <Route path="revenue" element={<AdminRevenuePage />} />
                    <Route path="items" element={<AdminItemsPage />} />
                    <Route path="items/deleted" element={<AdminDeletedItemsPage />} />
                    <Route path="items/legacy" element={<AdminLegacyItemsPage />} />
                    <Route path="notifications" element={<AdminNotificationsPage />} />
                    <Route path="activity" element={<AdminActivityPage />} />
                    <Route path="sessions" element={<AdminSessionsPage />} />
                  </Route>

                  <Route
                    path="/policedashboard"
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
                    <Route path="notifications" element={<PoliceNotificationsPage />} />
                    <Route path="activity" element={<PoliceActivityPage />} />
                    <Route path="topup" element={<PoliceTopupPage />} />
                    <Route path="pricing" element={<PolicePricingPage />} />
                  </Route>

                  <Route
                    path="/cashierdashboard"
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
                  </Route>

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