// src/layouts/AppLayout.jsx

import Header from "../components/Header";
import Footer from "../components/Footer";
import { Outlet } from "react-router-dom";
import { TransferProvider } from "../contexts/TransferContext";
import { NotificationProvider } from "../contexts/NotificationContext";
import { SidebarProvider, useSidebar } from "../contexts/SidebarContext";
import AppSidebar from "../components/AppSidebar";

export default function AppLayout() {
  return (
    <TransferProvider>
      <NotificationProvider>
        <SidebarProvider>
          <Header />
          <LayoutBody />
          <Footer />
        </SidebarProvider>
      </NotificationProvider>
    </TransferProvider>
  );
}

function LayoutBody() {
  const { sidebar } = useSidebar();
  const showSidebar = !!sidebar?.visible && (sidebar?.items?.length || 0) > 0;

  return (
    <>
      <AppSidebar sidebar={sidebar} />
      <main
        className={`bg-gray-100 pt-[var(--app-header-h)] pl-0 ${
          showSidebar
            ? "pl-[calc(var(--app-sidebar-collapsed-w)-1px)] sm:pl-[calc(var(--app-sidebar-collapsed-w)+var(--app-sidebar-gutter))]"
            : ""
        }`}
      >
        <Outlet />
      </main>
    </>
  );
}