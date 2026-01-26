import React from "react";
import Header from "../components/Header.jsx";
export default function PoliceDashboard(){
  return (
    <div className="min-h-screen bg-gray-100">
      <Header />
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-iregistrygreen">Police Dashboard</h1>
        <p className="text-sm text-gray-600 mt-2">Police-only investigative tools and case intake</p>
      </div>
    </div>
  );
}