// src/Pages/Signup.jsx

import { useState,useEffect } from "react";
import { supabase } from "../lib/supabase";
import Header from "../components/Header";
import CountryPhoneInput from "../components/CountryPhoneInput";

export default function Signup() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    // STEP 1 (7 required)
    first_name: "",
    last_name: "",
    id_number: "",
    date_of_birth: "",
    country: "",
    phone: "",
    email: "",

    // STEP 2 (7 optional)
    state: "",
    city: "",
    postal_code: "",
    address_line: "",
    alt_phone: "",
    landline: "",
    police_station: "",
  });

  const [errors, setErrors] = useState({});

  const [modal, setModal] = useState({
    open: false,
    title: "",
    message: "",
    type: "",
  });

    useEffect(() => {
    if (modal.type === "success") {
      const t = setTimeout(() => {
        window.location.href = "/login";
      }, 3000);

      return () => clearTimeout(t);
    }
  }, [modal.type]);

  // ----------------------------
  // STEP 1 VALIDATION (STRICT)
  // ----------------------------
  async function checkStep1Details() {
    const requiredChecks = [
      { field: "first_name", label: "First name" },
      { field: "last_name", label: "Last name" },
      { field: "id_number", label: "ID / Passport number" },
      { field: "date_of_birth", label: "Date of birth" },
      { field: "country", label: "Country" },
      { field: "phone", label: "Phone number" },
      { field: "email", label: "Email address" },
    ];

    // reset previous errors
    setErrors({});

    // find first missing field
    for (const check of requiredChecks) {
      if (!form[check.field]) {
        setErrors({ [check.field]: true });

        setModal({
          open: true,
          title: "Error",
          message: `${check.label} is required.`,
          type:"error"
        });

        return; // ⛔ STOP AT FIRST ERROR
      }
    }

    // ----------------------------
    // BACKEND CHECK (ID → PHONE → EMAIL)
    // ----------------------------
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "check-user-details",
        {
          body: {
            id_number: form.id_number,
            phone: form.phone,
            email: form.email,
            country: form.country,
          },
        }
      );

      if (error) {
        setModal({
          open: true,
          title: "Error",
          message: "Unable to reach server",
          type:"error",
        });
        return;
      }

      if (!data.success) {
        setModal({
          open: true,
          title: "Error",
          message: data.message,
          type: "error"
        });
        return;
      }

      // ✅ SILENT SUCCESS
      setStep(2);

    } catch {
      setModal({
        open: true,
        title: "Error",
        message: "Unexpected error occurred",
        type:"error",
      });
    } finally {
      setLoading(false);
    }
  }

  // ----------------------------
  // FINAL SUBMIT
  // ----------------------------
  async function handleSubmit() {
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        "create-user",
        { body: form }
      );

      if (error || data?.success === false) {
      setModal({
        open: true,
        title: "Error",
        message: data?.message || "Failed to create account",
        type: "error"
      });
      return;
    }

    // ✅ SHOW SUCCESS MODAL
    setModal({
      open: true,
      title: "Success",
      message: "Account created successfully",
      type: "success",
    });

    } catch {
      setModal({
        open: true,
        title: "Error",
        message: "Unexpected error occurred",
        type:"error",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Header />

      <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
        <div className="bg-white w-full max-w-lg rounded-2xl shadow-lg p-6">
          <h1 className="text-2xl font-bold text-iregistrygreen mb-1">
            Create Account
          </h1>

          <p className="text-sm text-gray-500 mb-4">
            Step {step} of 2
          </p>

          {/* ================= STEP 1 ================= */}
          {step === 1 && (
            <>
              <Input
                label="First name"
                value={form.first_name}
                error={errors.first_name}
                onChange={(v) =>
                  setForm((f) => ({ ...f, first_name: v }))
                }
              />

              <Input
                label="Last name"
                value={form.last_name}
                error={errors.last_name}
                onChange={(v) =>
                  setForm((f) => ({ ...f, last_name: v }))
                }
              />

              <Input
                label="ID / Passport number"
                value={form.id_number}
                error={errors.id_number}
                onChange={(v) =>
                  setForm((f) => ({ ...f, id_number: v }))
                }
              />

              <Input
                type="date"
                label="Date of birth"
                value={form.date_of_birth}
                error={errors.date_of_birth}
                onChange={(v) =>
                  setForm((f) => ({ ...f, date_of_birth: v }))
                }
              />

              {/* 🔒 WORKING SNIPPET — UNTOUCHED */}
              <CountryPhoneInput
                country={form.country}
                phone={form.phone}
                errorCountry={errors.country}
                errorPhone={errors.phone}
                onChange={({ country, phone }) =>
                  setForm((f) => ({ ...f, country, phone }))
                }
              />

              <Input
                label="Email address"
                type="email"
                value={form.email}
                error={errors.email}
                onChange={(v) =>
                  setForm((f) => ({ ...f, email: v }))
                }
              />

              <button
                onClick={checkStep1Details}
                disabled={loading}
                className="w-full mt-4 py-3 bg-iregistrygreen text-white rounded-lg"
              >
                {loading ? "Checking..." : "Continue"}
              </button>
            </>
          )}

          {/* ================= STEP 2 ================= */}
          {step === 2 && (
            <>
              <Input label="State" value={form.state}
                onChange={(v) => setForm(f => ({ ...f, state: v }))} required={false} />

              <Input label="City" value={form.city}
                onChange={(v) => setForm(f => ({ ...f, city: v }))} required={false} />

              <Input label="Postal code" value={form.postal_code}
                onChange={(v) => setForm(f => ({ ...f, postal_code: v }))} required={false} />

              <Input label="Address line" value={form.address_line}
                onChange={(v) => setForm(f => ({ ...f, address_line: v }))} required={false} />

              <Input label="Alt. phone" value={form.alt_phone}
                onChange={(v) => setForm(f => ({ ...f, alt_phone: v }))} required={false} />

              <Input label="Landline" value={form.landline}
                onChange={(v) => setForm(f => ({ ...f, landline: v }))} required={false} />

              <Input label="Police station" value={form.police_station}
                onChange={(v) => setForm(f => ({ ...f, police_station: v }))} required={false} />

              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setStep(1)}
                  className="w-1/2 border py-3 rounded-lg"
                >
                  Back
                </button>

                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-1/2 bg-iregistrygreen text-white py-3 rounded-lg"
                >
                  {loading ? "Creating..." : "Create account"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ================= MODAL ================= */}
      {modal.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-80 text-center">
            {/* ICON */}
            <div className="mb-3">
              {modal.type === "error" && (
                <span className="text-4xl text-red-600">❌</span>
              )}
              {modal.type === "success" && (
                <span className="text-4xl text-green-600">✅</span>
              )}
            </div>

            {/* TITLE */}
            <h2
              className={`font-semibold mb-2 ${
                modal.type === "error"
                  ? "text-red-600"
                  : modal.type === "success"
                  ? "text-green-600"
                  : "text-gray-800"
              }`}
            >
              {modal.title}
            </h2>

            {/* MESSAGE */}
            <p
              className={`mb-4 ${
                modal.type === "error"
                  ? "text-red-600"
                  : modal.type === "success"
                  ? "text-green-600"
                  : "text-gray-700"
              }`}
            >
              {modal.message}
            </p>

            {/* BUTTON (hidden for auto-closing success) */}
            {modal.type !== "success" && (
              <button
                onClick={() =>
                  setModal({ open: false, title: "", message: "", type: "" })
                }
                className="w-full py-2 bg-iregistrygreen text-white rounded-lg"
              >
                OK
              </button>
            )}

            {modal.type === "success" && (
              <p className="text-xs text-gray-400 mt-2">
                Redirecting to login…
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ----------------------------
// INPUT COMPONENT
// ----------------------------
function Input({
  label,
  value,
  onChange,
  type = "text",
  required = true,
  error,
}) {
  return (
    <div className="mb-4">
      <label className="block text-sm mb-1">
        {label} {required && <span className="text-red-600">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full border rounded-lg px-4 py-2 ${
          error ? "border-red-500" : ""
        }`}
      />
    </div>
  );
}