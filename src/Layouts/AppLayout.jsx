// src/layouts/AppLayout.jsx

import Header from "../components/Header";
import Footer from "../components/Footer";
import BottomNav from "../components/BottomNav";
import { Outlet } from "react-router-dom";
import { TransferProvider } from "../contexts/TransferContext";
import { NotificationProvider } from "../contexts/NotificationContext";
import { SidebarProvider, useSidebar } from "../contexts/SidebarContext";
import AppSidebar from "../components/AppSidebar";
import { useAuth } from "../contexts/AuthContext.jsx";
import { roleIs } from "../lib/roleUtils.js";
import { useEffect, useRef } from "react";

export default function AppLayout() {
  const footerWrapRef = useRef(null);

  useEffect(() => {
    const el = footerWrapRef.current;
    if (!el) return;

    const apply = () => {
      const h = Math.max(0, Math.round(el.getBoundingClientRect().height || 0));
      document.documentElement.style.setProperty("--app-footer-h", `${h}px`);
    };

    apply();

    const ro = new ResizeObserver(() => apply());
    ro.observe(el);
    window.addEventListener("resize", apply);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, []);

  return (
    <TransferProvider>
      <NotificationProvider>
        <SidebarProvider>
          <div className="min-h-dvh min-h-screen flex flex-col bg-gray-100">
            <Header />
            <div className="flex flex-1 flex-col min-h-0 pt-[var(--app-header-h)]">
              <LayoutBody />
            </div>
            <div ref={footerWrapRef}>
              <Footer />
            </div>
          </div>
        </SidebarProvider>
      </NotificationProvider>
    </TransferProvider>
  );
}

function LayoutBody() {
  const { sidebar } = useSidebar();
  const { user } = useAuth();
  const showSidebar =
    !!sidebar?.visible &&
    ((sidebar?.items?.length || 0) > 0 || !!sidebar?.staffScopeRail);
  const showUserBottomNav = roleIs(user?.role, "user");

  return (
    <>
      {!sidebar?.staffScopeRail ? <AppSidebar sidebar={sidebar} /> : null}
      <main
        className={`flex flex-1 flex-col min-h-0 bg-gray-100 pl-0 ${
          showSidebar
            ? "pl-[calc(var(--app-sidebar-collapsed-w)+4px)] sm:pl-[calc(var(--app-sidebar-collapsed-w)+var(--app-sidebar-gutter))]"
            : ""
        } ${showUserBottomNav ? "pb-16 sm:pb-0" : ""}`}
      >
        <Outlet />
      </main>
      {showUserBottomNav ? <BottomNav /> : null}
    </>
  );
}