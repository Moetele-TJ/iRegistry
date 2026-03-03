// src/layouts/AppLayout.jsx

import Header from "../components/Header";
import Footer from "../components/Footer";
import { Outlet } from "react-router-dom";
import { TransferProvider } from "../contexts/TransferContext";
import { NotificationProvider } from "../contexts/NotificationContext";

export default function AppLayout() {
  return (
    <TransferProvider>
      <NotificationProvider>
        <Header />

        <main>
          <Outlet />
        </main>

        <Footer />
      </NotificationProvider>
    </TransferProvider>
  );
}