// src/Pages/Signup.jsx
import { useNavigate, useSearchParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { Gift } from "lucide-react";
import { invokeFn } from "../lib/invokeFn";
import CountryPhoneInput from "../components/CountryPhoneInput";
import PoliceStationSelect from "../components/PoliceStationSelect.jsx";
import TownWardStationSelect from "../components/TownWardStationSelect.jsx";
import YearMonthDaySelect from "../components/YearMonthDaySelect.jsx";
import { countries } from "../Data/countries";
import { formControlClass } from "../lib/formFieldStyles.js";
import { normalizeAgentNumber } from "../lib/referralAgentNumber.js";

export default function Signup() {

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [referralGateOpen, setReferralGateOpen] = useState(true);
  const [referralGateDraft, setReferralGateDraft] = useState("");
  const [referralGateError, setReferralGateError] = useState("");
  const [referralCodeLocked, setReferralCodeLocked] = useState(false);

  const [form, setForm] = useState({
    // STEP 1 — identity + contact + location (required)
    first_name: "",
    last_name: "",
    id_number: "",
    date_of_birth: "",
    country: "",
    phone: "",
    email: "",
    police_station: "",

    // STEP 2 (optional) — extra address / contact details
    state: "",
    village: "",
    postal_code: "",
    ward: "",
    alt_phone: "",
    landline: "",
    referral_code: "",
  });

  const [errors, setErrors] = useState({});

  function setField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => {
      if (!e[field]) return e;
      const next = { ...e };
      delete next[field];
      return next;
    });
  }

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

  useEffect(() => {
    const fromUrl =
      searchParams.get("ref") ||
      searchParams.get("referral") ||
      searchParams.get("agent") ||
      "";
    const trimmed = String(fromUrl).trim();
    if (trimmed) {
      setReferralGateDraft(trimmed);
    }
  }, [searchParams]);

  function skipReferralGate() {
    setReferralGateError("");
    setReferralGateOpen(false);
  }

  function applyReferralFromGate() {
    const raw = String(referralGateDraft || "").trim();
    if (!raw) {
      skipReferralGate();
      return;
    }

    const canonical = normalizeAgentNumber(raw);
    if (!canonical) {
      setReferralGateError("Enter a valid code (e.g. IR-1001, IR1001, or ir-1001).");
      return;
    }

    setField("referral_code", canonical);
    setReferralCodeLocked(true);
    setReferralGateError("");
    setReferralGateOpen(false);
  }

  // ----------------------------
  // STEP 1 VALIDATION (STRICT)
  // ----------------------------
  async function checkStep1Details() {
    // Order matches the step-1 form top-to-bottom so we never flag a field below the user's position.
    const requiredChecks = [
      { field: "first_name", label: "First name" },
      { field: "last_name", label: "Last name" },
      { field: "id_number", label: "ID / Passport number" },
      { field: "date_of_birth", label: "Date of birth" },
      { field: "country", label: "Country" },
      { field: "phone", label: "Phone number" },
      { field: "village", label: "Town / village" },
      { field: "ward", label: "Ward / street" },
      { field: "police_station", label: "Nearest police station" },
      { field: "email", label: "Email address" },
    ];

    // reset previous errors
    setErrors({});

    // find first missing field (phone: country select only pre-fills dial code — not a real number)
    for (const check of requiredChecks) {
      const missing =
        check.field === "phone"
          ? !isSignupPhoneEntered(form.country, form.phone)
          : !String(form[check.field] ?? "").trim();

      if (missing) {
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

    const locationChecks = [
      { field: "village", label: "Town / village" },
      { field: "ward", label: "Ward / street" },
      { field: "police_station", label: "Nearest police station" },
      { field: "email", label: "Email address" },
    ];
    for (const check of locationChecks) {
      if (!String(form[check.field] || "").trim()) {
        setErrors({ [check.field]: true });
        setModal({
          open: true,
          title: "Error",
          message: `${check.label} is required.`,
          type: "error",
        });
        return;
      }
    }

    setLoading(true);

    try {
      const { data, error } = await invokeFn(
        "create-user",
        {
          body: {
            ...form,
            agent_number: form.referral_code,
          },
        },
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

  const stepBlurb =
    step === 1
      ? "Step 1 of 2 · Enter your details, then continue."
      : "Step 2 of 2 · Optional extra details.";

  return (
    <>
      <div className="flex w-full flex-1 min-h-0 flex-col bg-gray-100">
        <div className="mx-auto w-full max-w-3xl flex-1 p-4 pb-24 sm:p-6 sm:pb-28 md:pb-32">
          <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-lg">
            <div className="border-b border-emerald-100/90 bg-emerald-50/90 px-5 py-4 sm:px-6 sm:py-5">
              <h1 className="text-2xl font-bold text-gray-900">Create Account</h1>
              <p className="mt-1 text-sm text-gray-600">{stepBlurb}</p>
            </div>

            <div className="p-6 sm:p-8">
              {/* ================= STEP 1 ================= */}
              {step === 1 && (
                <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="First name"
                  value={form.first_name}
                  error={errors.first_name}
                  onChange={(v) => setField("first_name", v)}
                />

                <Input
                  label="Last name"
                  value={form.last_name}
                  error={errors.last_name}
                  onChange={(v) => setField("last_name", v)}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  label="ID / Passport number"
                  value={form.id_number}
                  error={errors.id_number}
                  onChange={(v) => setField("id_number", v)}
                />

                <YearMonthDaySelect
                  label="Date of birth"
                  value={form.date_of_birth}
                  error={errors.date_of_birth}
                  onChange={(v) => setField("date_of_birth", v)}
                  maxYear={new Date().getFullYear()}
                  minYear={1920}
                  selectClassName={formControlClass}
                />
              </div>

              <CountryPhoneInput
                country={form.country}
                phone={form.phone}
                errorCountry={errors.country}
                errorPhone={errors.phone}
                onChange={({ country, phone }) => {
                  setForm((f) => ({ ...f, country, phone }));
                  setErrors((e) => {
                    const next = { ...e };
                    if (country) delete next.country;
                    if (phone) delete next.phone;
                    return next;
                  });
                }}
              />

              <div
                className={
                  errors.village || errors.ward
                    ? "rounded-lg ring-1 ring-red-500 ring-offset-1"
                    : ""
                }
              >
                <TownWardStationSelect
                  town={form.village}
                  ward={form.ward}
                  station=""
                  showStation={false}
                  requiredTown
                  requiredWard
                  withAuth={false}
                  disabled={loading}
                  townLabel="Town / village"
                  wardLabel="Ward / street"
                  inputClassName={`${formControlClass} ${
                    errors.village || errors.ward ? "border-red-500" : ""
                  }`}
                  onTownChange={(v) => {
                    setForm((f) => {
                      const prev = String(f.village ?? "").trim();
                      const next = String(v ?? "").trim();
                      if (prev === next) return f;
                      return { ...f, village: v, ward: "" };
                    });
                    setErrors((e) => {
                      const next = { ...e };
                      delete next.village;
                      delete next.ward;
                      return next;
                    });
                  }}
                  onWardChange={(v) => setField("ward", v)}
                  onStationChange={() => {}}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-end">
                <div
                  className={
                    errors.police_station
                      ? "rounded-lg ring-1 ring-red-500 ring-offset-1 min-w-0"
                      : "min-w-0"
                  }
                >
                  <PoliceStationSelect
                    label="Nearest police station"
                    value={form.police_station}
                    onChange={(v) => setField("police_station", v)}
                    required
                    withAuth={false}
                    variant="searchable"
                    inputClassName={`${formControlClass} ${
                      errors.police_station ? "border-red-500" : ""
                    }`}
                    placeholder="Select or type your nearest police station"
                    helpText="Pick a station from the list, search to narrow it, or type a name if yours is not listed."
                  />
                </div>

                <Input
                  label="Email address"
                  type="email"
                  value={form.email}
                  error={errors.email}
                  onChange={(v) => setField("email", v)}
                />
              </div>

              <div className="text-center text-sm text-gray-600">
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
                className="w-full rounded-lg bg-iregistrygreen py-3 font-semibold text-white disabled:opacity-60"
              >
                {loading ? "Checking..." : "Continue"}
              </button>
                </div>
              )}

              {/* ================= STEP 2 ================= */}
              {step === 2 && (
                <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

              <Input
                label="Referral code (optional)"
                value={form.referral_code}
                onChange={(v) => setField("referral_code", v)}
                required={false}
                readOnly={referralCodeLocked}
                placeholder="e.g. IR-1001"
                helpText={
                  referralCodeLocked
                    ? "Applied at signup. This code is locked."
                    : "If someone helped you register, enter their referral code here."
                }
              />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

              <div className="text-center text-sm text-gray-600">
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
                  className="w-full rounded-lg border border-gray-300 py-3 font-semibold text-gray-700 sm:w-auto sm:min-w-[10rem]"
                >
                  Back
                </button>

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-full rounded-lg bg-iregistrygreen py-3 font-semibold text-white disabled:opacity-60 sm:w-auto sm:min-w-[12rem] lg:min-w-[14rem]"
                >
                  {loading ? "Creating..." : "Create account"}
                </button>
              </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {referralGateOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="referral-gate-title"
        >
          <div className="w-full max-w-md rounded-2xl border-2 border-red-400 bg-white shadow-2xl shadow-red-200/40 overflow-hidden">
            <div className="bg-gradient-to-br from-red-50 via-amber-50 to-white px-6 py-5 border-b border-red-100">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white p-2.5 shrink-0 shadow-sm">
                  <Gift size={20} />
                </div>
                <div>
                  <h2 id="referral-gate-title" className="text-lg font-bold text-gray-900">
                    Do you have a referral code?
                  </h2>
                  <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                    If someone helped you sign up, enter their code now. You can also continue without one.
                  </p>
                </div>
              </div>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label htmlFor="referral-gate-input" className="block text-sm font-medium text-gray-700 mb-1">
                  Referral code
                </label>
                <input
                  id="referral-gate-input"
                  type="text"
                  value={referralGateDraft}
                  onChange={(e) => {
                    setReferralGateDraft(e.target.value);
                    if (referralGateError) setReferralGateError("");
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      applyReferralFromGate();
                    }
                  }}
                  placeholder="e.g. IR-1001"
                  autoFocus
                  className={`${formControlClass} ${referralGateError ? "border-red-500" : ""}`}
                />
                {referralGateError ? (
                  <p className="text-xs text-red-600 mt-1">{referralGateError}</p>
                ) : (
                  <p className="text-xs text-gray-500 mt-1">
                    Formats like IR1001, ir-1001, and IR-1001 all work.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={skipReferralGate}
                  className="w-full sm:w-auto rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Continue without code
                </button>
                <button
                  type="button"
                  onClick={applyReferralFromGate}
                  className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-amber-300/40 hover:from-amber-600 hover:via-orange-600 hover:to-amber-700"
                >
                  {referralGateDraft.trim() ? "Continue with code" : "Continue"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

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

/** True when the user entered national digits, not just the country dial code. */
function isSignupPhoneEntered(countryCode, phone) {
  const cc = String(countryCode ?? "").trim();
  const ph = String(phone ?? "").trim();
  if (!cc || !ph) return false;

  const meta = countries.find((c) => c.code === cc);
  if (!meta) return false;

  const digitsOnly = ph.replace(/\D/g, "");
  const nationalNumber = digitsOnly.replace(
    String(meta.dialCode).replace("+", ""),
    "",
  );
  return nationalNumber.length > 0;
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
  placeholder,
  helpText,
  readOnly = false,
}) {
  return (
    <div className="min-w-0">
      <label className="block text-sm mb-1">
        {label} {required && <span className="text-red-600">*</span>}
        {readOnly ? (
          <span className="ml-2 text-xs font-normal text-amber-700">(locked)</span>
        ) : null}
      </label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        disabled={readOnly}
        onChange={(e) => onChange(e.target.value)}
        className={`${formControlClass} ${error ? "border-red-500" : ""} ${
          readOnly ? "bg-amber-50/60 border-amber-200 text-gray-800 cursor-not-allowed" : ""
        }`}
      />
      {helpText ? <p className="text-xs text-gray-500 mt-1">{helpText}</p> : null}
    </div>
  );
}