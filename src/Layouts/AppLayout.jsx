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
      <main className={showSidebar ? "pl-4" : ""}>
        <Outlet />
      </main>
    </>
  );
}