// src/layouts/AppLayout.jsx
import Header from "../components/Header";
import Footer from "../components/Footer"
import { Outlet } from "react-router-dom";

export default function AppLayout() {
  return (
    <>
      <Header />
      {/* THIS is where routed pages render */}
      <main>
        <Outlet />
      </main>

      <Footer/>
    </>
  );
}