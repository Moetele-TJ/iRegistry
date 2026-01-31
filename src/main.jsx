// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

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
import AdminLayout from "./Pages/admin/AdminLayout.jsx";
import PoliceDashboard from "./Pages/PoliceDashboard.jsx";
import AdminHome from "./Pages/admin/AdminHome.jsx";
import AdminUsers from "./Pages/admin/AdminUsers.jsx";
import AdminAuditLogs from "./Pages/admin/AdminAuditLogs.jsx";
import AdminSettings from "./Pages/admin/AdminSettings.jsx";



// AUTH PAGES
import Login from "./Pages/Login.jsx";
import Signup from "./Pages/Signup.jsx";

// CONTEXTS
import { ItemsProvider } from "./contexts/ItemsContext.jsx";
import { ToastProvider } from "./contexts/ToastContext.jsx";
import { AuthProvider } from "./contexts/AuthContext.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <ItemsProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>

              {/* ===== LAYOUT ROUTE (Header always visible) ===== */}
              <Route element={<AppLayout />}>

                {/* Public */}
                <Route path="/" element={<HomePage />} />
                <Route path="/unauthorized" element={<Unauthorized />} />

                {/* Role resolver */}
                <Route path="/redirect" element={<RoleRedirect />} />

                {/* Auth pages (DO NOT WRAP) */}
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />

                {/* Dashboards */}
                <Route
                  path="/user"
                  element={
                    <ProtectedRoute allowedRoles={["user", "admin", "police"]}>
                      <UserDashboard />
                    </ProtectedRoute>
                  }
                />

                {/* ADMIN DASHBOARD (NESTED) */}
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute allowedRoles={["admin"]}>
                      <AdminLayout />
                    </ProtectedRoute>
                  }
                >
                  {/* Default admin landing page */}
                  <Route index element={<AdminHome />} />

                  <Route path="users" element={<AdminUsers />} />
                  <Route path="audit-logs" element={<AdminAuditLogs />} />
                  <Route path="settings" element={<AdminSettings />} />
                </Route>

                <Route
                  path="/police"
                  element={
                    <ProtectedRoute allowedRoles={["police", "admin"]}>
                      <PoliceDashboard />
                    </ProtectedRoute>
                  }
                />

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
                    <ProtectedRoute allowedRoles={["user", "admin"]}>
                      <AddItem />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/items/:id"
                  element={
                    <ProtectedRoute allowedRoles={["user", "admin", "police"]}>
                      <ItemDetails />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/items/:id/edit"
                  element={
                    <ProtectedRoute allowedRoles={["admin"]}>
                      <EditItem />
                    </ProtectedRoute>
                  }
                />

              </Route>
              
              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />

            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </ItemsProvider>
    </AuthProvider>
  </React.StrictMode>
);