// src/Pages/Signup.jsx
import { useNavigate } from "react-router-dom";
import { useState,useEffect } from "react";
import { invokeFn } from "../lib/invokeFn";
import CountryPhoneInput from "../components/CountryPhoneInput";
import PoliceStationSelect from "../components/PoliceStationSelect.jsx";

export default function Signup() {

  const navigate = useNavigate();
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

    // STEP 2 (optional) — village/ward match items + validate-session profile
    state: "",
    village: "",
    postal_code: "",
    ward: "",
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
        navigate("/login", { replace: true });
      }, 3000);

      return () => clearTimeout(t);
    }
  }, [modal.type, navigate]);

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
      const { data, error } = await invokeFn(
        "check-user-details",
        {
          body: {
            id_number: form.id_number,
            phone: form.phone,
            email: form.email,
            country: form.country,
          },
        },
        { withAuth: false }
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

    if (loading) return;

    setLoading(true);

    try {
      const { data, error } = await invokeFn(
        "create-user",
        { body: form },
        { withAuth: false }
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
      <div className="flex w-full flex-1 min-h-0 flex-col items-center justify-center bg-gray-100 px-4 py-12 pb-24 sm:px-6 sm:py-14 sm:pb-28 md:py-16 md:pb-32">
        <div className="bg-white w-full max-w-lg rounded-2xl shadow-lg p-6 sm:max-w-2xl sm:p-8 lg:max-w-4xl lg:p-10 xl:max-w-5xl">
          <h1 className="text-2xl font-bold text-iregistrygreen mb-2 sm:text-3xl">
            Create Account
          </h1>

          <p className="text-sm text-gray-500 mb-6 sm:mb-8">
            Step {step} of 2
          </p>

          {/* ================= STEP 1 ================= */}
          {step === 1 && (
            <div className="flex flex-col gap-4 sm:gap-5">
              <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2">
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
              </div>

              <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2">
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
              </div>

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

              <div className="text-sm text-center pt-2 sm:pt-4">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="text-iregistrygreen font-semibold hover:underline"
                >
                  Continue to login
                </button>
              </div>

              <button
                type="button"
                onClick={checkStep1Details}
                disabled={loading}
                className="w-full py-3 rounded-lg bg-iregistrygreen text-white font-semibold disabled:opacity-60"
              >
                {loading ? "Checking..." : "Continue"}
              </button>
            </div>
          )}

          {/* ================= STEP 2 ================= */}
          {step === 2 && (
            <div className="flex flex-col gap-4 sm:gap-5">
              <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2">
                <Input
                  label="District"
                  value={form.state}
                  onChange={(v) => setForm((f) => ({ ...f, state: v }))}
                  required={false}
                />

                <Input
                  label="Postal code"
                  value={form.postal_code}
                  onChange={(v) => setForm((f) => ({ ...f, postal_code: v }))}
                  required={false}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2">
                <Input
                  label="Town / village"
                  value={form.village}
                  onChange={(v) => setForm((f) => ({ ...f, village: v }))}
                  required={false}
                />

                <Input
                  label="Ward / street"
                  value={form.ward}
                  onChange={(v) => setForm((f) => ({ ...f, ward: v }))}
                  required={false}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2">
                <Input
                  label="Alt. phone"
                  value={form.alt_phone}
                  onChange={(v) => setForm((f) => ({ ...f, alt_phone: v }))}
                  required={false}
                />

                <Input
                  label="Landline"
                  value={form.landline}
                  onChange={(v) => setForm((f) => ({ ...f, landline: v }))}
                  required={false}
                />
              </div>

              <PoliceStationSelect
                label="Police station"
                value={form.police_station}
                onChange={(v) => setForm((f) => ({ ...f, police_station: v }))}
                required={false}
                withAuth={false}
                variant="combobox"
                inputClassName="w-full border rounded-lg px-4 py-2"
              />

              <div className="text-sm text-center pt-2 sm:pt-4">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="text-iregistrygreen font-semibold hover:underline"
                >
                  Continue to login
                </button>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-full py-3 rounded-lg border border-gray-300 text-gray-700 font-semibold sm:w-auto sm:min-w-[10rem]"
                >
                  Back
                </button>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-full py-3 rounded-lg bg-iregistrygreen text-white font-semibold disabled:opacity-60 sm:w-auto sm:min-w-[12rem] lg:min-w-[14rem]"
                >
                  {loading ? "Creating..." : "Create account"}
                </button>
              </div>
            </div>
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
                className="w-full py-2 rounded-lg bg-iregistrygreen text-white font-semibold"
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
    <div className="min-w-0">
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