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
import { useLayoutEffect, useRef } from "react";

export default function AppLayout() {
  const footerWrapRef = useRef(null);

  useLayoutEffect(() => {
    const footerEl = footerWrapRef.current;
    const root = document.documentElement;
    if (!footerEl) return;

    const overlayTop = (el) => {
      if (!el) return null;
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden") return null;
      const r = el.getBoundingClientRect();
      if (r.width <= 0 && r.height <= 0) return null;
      return r.top;
    };

    const apply = () => {
      const footerRect = footerEl.getBoundingClientRect();
      const footerH = Math.max(0, Math.round(footerRect.height || 0));
      root.style.setProperty("--app-footer-h", `${footerH}px`);

      const vh = window.innerHeight;
      const headerH = parseFloat(getComputedStyle(root).getPropertyValue("--app-header-h")) || 0;
      const minSidebarH = 96;
      let inset = 0;

      const raiseTo = (top) => {
        if (!Number.isFinite(top) || top >= vh) return;
        inset = Math.max(inset, vh - top);
      };

      raiseTo(footerRect.top);
      raiseTo(overlayTop(document.querySelector("[data-app-bottom-nav]")));

      const maxInset = Math.max(0, vh - headerH - minSidebarH);
      const nextInset = `${Math.round(Math.min(Math.max(0, inset), maxInset))}px`;
      if (root.style.getPropertyValue("--app-sidebar-bottom-inset") !== nextInset) {
        root.style.setProperty("--app-sidebar-bottom-inset", nextInset);
      }
    };

    let raf = 0;
    const schedule = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        apply();
      });
    };

    apply();

    const ro = new ResizeObserver(schedule);
    ro.observe(footerEl);
    if (document.body) ro.observe(document.body);

    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, { capture: true, passive: true });
    window.visualViewport?.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("scroll", schedule);

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      window.visualViewport?.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", schedule);
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
            <div ref={footerWrapRef} data-app-footer>
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