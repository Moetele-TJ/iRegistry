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
import UserNotificationsPage from "./Pages/user/UserNotificationsPage.jsx";
import UserActivityPage from "./Pages/user/UserActivityPage.jsx";
import AdminLayout from "./Pages/admin/AdminLayout.jsx";
import AdminHome from "./Pages/admin/AdminHome.jsx";
import AdminUsers from "./Pages/admin/AdminUsers.jsx";
import AdminAuditLogs from "./Pages/admin/AdminAuditLogs.jsx";
import AdminSettings from "./Pages/admin/AdminSettings.jsx";
import AdminItemsPage from "./Pages/admin/AdminItemsPage.jsx";
import AdminNotificationsPage from "./Pages/admin/AdminNotificationsPage.jsx";
import AdminActivityPage from "./Pages/admin/AdminActivityPage.jsx";
import PoliceLayout from "./Pages/police/PoliceLayout.jsx";
import PoliceHome from "./Pages/police/PoliceHome.jsx";
import PoliceItemsPage from "./Pages/police/PoliceItemsPage.jsx";
import PoliceNotificationsPage from "./Pages/police/PoliceNotificationsPage.jsx";
import PoliceActivityPage from "./Pages/police/PoliceActivityPage.jsx";

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
                      <ProtectedRoute allowedRoles={["user", "admin", "police", "cashier"]}>
                        <UserLayout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<UserDashboard />} />
                    <Route path="profile" element={<ProfilePage />} />
                    <Route path="items" element={<UserItemsPage />} />
                    <Route path="notifications" element={<UserNotificationsPage />} />
                    <Route path="activity" element={<UserActivityPage />} />
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
                    <Route path="items" element={<AdminItemsPage />} />
                    <Route path="notifications" element={<AdminNotificationsPage />} />
                    <Route path="activity" element={<AdminActivityPage />} />
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
                    <Route path="notifications" element={<PoliceNotificationsPage />} />
                    <Route path="activity" element={<PoliceActivityPage />} />
                  </Route>

                  {/* Items */}
                  <Route
                    path="/items"
                    element={
                      <ProtectedRoute allowedRoles={["user", "admin", "police"]}>
                        <Items />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="/items/add"
                    element={
                      <ProtectedRoute allowedRoles={["user", "admin", "police"]}>
                        <AddItem />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="/items/:slug"
                    element={
                      <ProtectedRoute allowedRoles={["user", "admin", "police"]}>
                        <ItemDetails />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="/items/:id/edit"
                    element={
                      <ProtectedRoute allowedRoles={["user", "admin", "police"]}>
                        <EditItem />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="/notifications"
                    element={
                      <ProtectedRoute allowedRoles={["user", "admin", "police"]}>
                        <Notifications />
                      </ProtectedRoute>
                    }
                  />

                  <Route
                    path="/activity"
                    element={
                      <ProtectedRoute allowedRoles={["user", "admin", "police"]}>
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