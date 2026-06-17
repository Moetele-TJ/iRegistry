// src/Pages/Signup.jsx
import { useNavigate, useSearchParams } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { Gift } from "lucide-react";
import { invokeFn } from "../lib/invokeFn";
import { useToast } from "../contexts/ToastContext.jsx";
import CountryPhoneInput from "../components/CountryPhoneInput";
import PoliceStationSelect from "../components/PoliceStationSelect.jsx";
import TownWardStationSelect from "../components/TownWardStationSelect.jsx";
import YearMonthDaySelect from "../components/YearMonthDaySelect.jsx";
import { countries } from "../Data/countries";
import { formControlClass } from "../lib/formFieldStyles.js";

export default function Signup() {

  const navigate = useNavigate();
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [competitionActive, setCompetitionActive] = useState(false);
  const [competitionChecked, setCompetitionChecked] = useState(false);
  const [referralGateOpen, setReferralGateOpen] = useState(false);
  const [referralGateDraft, setReferralGateDraft] = useState("");
  const [referralCodeLocked, setReferralCodeLocked] = useState(false);
  const [invalidReferralModalOpen, setInvalidReferralModalOpen] = useState(false);
  const [invalidReferralWarnCount, setInvalidReferralWarnCount] = useState(0);
  const referralCodeInputRef = useRef(null);

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
    let cancelled = false;

    async function loadCompetitionStatus() {
      const { data, error } = await invokeFn(
        "get-public-stats",
        {},
        { withAuth: false },
      );

      if (cancelled) return;

      const active = !error && data?.success && Boolean(data.referral_competition_active);
      setCompetitionActive(active);
      setCompetitionChecked(true);
      if (active) {
        setReferralGateOpen(true);
      }
    }

    void loadCompetitionStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!competitionChecked) return;

    const fromUrl =
      searchParams.get("ref") ||
      searchParams.get("referral") ||
      searchParams.get("agent") ||
      "";
    const trimmed = String(fromUrl).trim();
    if (!trimmed) return;

    if (competitionActive) {
      setReferralGateDraft(trimmed);
      return;
    }

    setField("referral_code", trimmed);
  }, [searchParams, competitionActive, competitionChecked]);

  function skipReferralGate() {
    setReferralGateOpen(false);
  }

  function handleReferralGateContinue() {
    const raw = String(referralGateDraft || "").trim();
    if (raw.length < 4) {
      skipReferralGate();
      return;
    }

    setField("referral_code", raw);
    setReferralCodeLocked(true);
    setReferralGateOpen(false);
  }

  const referralGateHasCode = String(referralGateDraft || "").trim().length >= 4;

  async function verifyReferralCode(raw) {
    const { data, error } = await invokeFn(
      "check-user-details",
      { body: { mode: "referral", referral_code: raw } },
      { withAuth: false },
    );
    if (error || !data?.success) {
      return { ok: false, message: data?.message || error?.message || "Unable to verify referral code." };
    }
    return {
      ok: true,
      exists: Boolean(data.exists),
      canonical: data.canonical ? String(data.canonical) : null,
    };
  }

  async function submitCreateUser({ omitReferral = false } = {}) {
    const payload = {
      ...form,
      agent_number: omitReferral ? "" : form.referral_code,
      referral_code: omitReferral ? "" : form.referral_code,
    };

    const { data, error } = await invokeFn(
      "create-user",
      { body: payload },
      { withAuth: false },
    );

    if (error || data?.success === false) {
      setModal({
        open: true,
        title: "Error",
        message: data?.message || "Failed to create account",
        type: "error",
      });
      return false;
    }

    setModal({
      open: true,
      title: "Success",
      message: "Account created successfully",
      type: "success",
    });
    return true;
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
  async function handleSubmit({ skipReferralCheck = false, omitReferral = false } = {}) {

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

    const referralRaw = omitReferral ? "" : String(form.referral_code || "").trim();

    setLoading(true);

    try {
      if (competitionActive && !skipReferralCheck && referralRaw) {
        const check = await verifyReferralCode(referralRaw);
        if (!check.ok) {
          setModal({
            open: true,
            title: "Error",
            message: check.message,
            type: "error",
          });
          return;
        }

        if (!check.exists) {
          const nextWarnCount = invalidReferralWarnCount + 1;
          setInvalidReferralWarnCount(nextWarnCount);

          if (nextWarnCount > 3) {
            setReferralCodeLocked(false);
            setField("referral_code", "");
            setErrors((e) => {
              const next = { ...e };
              delete next.referral_code;
              return next;
            });
            addToast({
              type: "info",
              message:
                "Account saved without a referral code. It will not count toward the referral competition.",
              duration: 6000,
            });
            await submitCreateUser({ omitReferral: true });
            return;
          }

          setReferralCodeLocked(false);
          setErrors((e) => ({ ...e, referral_code: true }));
          setInvalidReferralModalOpen(true);
          return;
        }

        if (check.canonical && check.canonical !== form.referral_code) {
          setField("referral_code", check.canonical);
        }
      }

      await submitCreateUser({ omitReferral });

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

  function handleContinueWithoutReferral() {
    setInvalidReferralModalOpen(false);
    setField("referral_code", "");
    setErrors((e) => {
      const next = { ...e };
      delete next.referral_code;
      return next;
    });
    void handleSubmit({ skipReferralCheck: true, omitReferral: true });
  }

  function handleEditReferralCode() {
    setInvalidReferralModalOpen(false);
    setReferralCodeLocked(false);
    setErrors((e) => ({ ...e, referral_code: true }));
    requestAnimationFrame(() => {
      referralCodeInputRef.current?.focus();
      referralCodeInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
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
                error={errors.referral_code}
                inputRef={referralCodeInputRef}
                inputId="signup-referral-code-input"
                placeholder="e.g. IR-1001"
                helpText={
                  referralCodeLocked
                    ? "Prefilled from the signup prompt. It will be verified when you create your account."
                    : errors.referral_code
                      ? "This referral code was not found. Update it or continue without a code."
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
                  onClick={() => void handleSubmit()}
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

      {competitionActive && referralGateOpen ? (
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
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleReferralGateContinue();
                    }
                  }}
                  placeholder="e.g. IR-1001"
                  autoFocus
                  className={formControlClass}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Formats like IR1001, ir-1001, and IR-1001 all work. We will verify the code when you save.
                </p>
              </div>

              <button
                type="button"
                onClick={handleReferralGateContinue}
                className="w-full rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-amber-300/40 hover:from-amber-600 hover:via-orange-600 hover:to-amber-700"
              >
                {referralGateHasCode ? "Continue" : "Continue without code"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {competitionActive && invalidReferralModalOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="invalid-referral-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl border border-red-200 p-6">
            <h2 id="invalid-referral-title" className="text-lg font-semibold text-red-700">
              Referral code not found
            </h2>
            <p className="text-sm text-gray-600 mt-2 leading-relaxed">
              We could not find an active account with code{" "}
              <span className="font-semibold text-gray-900">{form.referral_code || "—"}</span>.
              You can correct the code or create your account without a referral.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={handleEditReferralCode}
                className="w-full sm:w-auto rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Edit referral code
              </button>
              <button
                type="button"
                onClick={handleContinueWithoutReferral}
                disabled={loading}
                className="w-full sm:w-auto rounded-xl bg-iregistrygreen px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                Continue without code
              </button>
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
  inputRef,
  inputId,
}) {
  return (
    <div className="min-w-0">
      <label className="block text-sm mb-1" htmlFor={inputId}>
        {label} {required && <span className="text-red-600">*</span>}
        {readOnly ? (
          <span className="ml-2 text-xs font-normal text-amber-700">(locked)</span>
        ) : null}
      </label>
      <input
        id={inputId}
        ref={inputRef}
        type={type}
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        disabled={readOnly}
        onChange={(e) => onChange(e.target.value)}
        className={`${formControlClass} ${error ? "border-red-500 ring-1 ring-red-200" : ""} ${
          readOnly ? "bg-amber-50/60 border-amber-200 text-gray-800 cursor-not-allowed" : ""
        }`}
      />
      {helpText ? (
        <p className={`text-xs mt-1 ${error ? "text-red-600" : "text-gray-500"}`}>{helpText}</p>
      ) : null}
    </div>
  );
}