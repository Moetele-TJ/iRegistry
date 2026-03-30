// src/Pages/Login.jsx

import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

export default function Login() {
  const [step, setStep] = useState("identity"); // identity | otp | channel
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");

  const [lastName, setLastName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [userId, setUserId] = useState("");
  const [otp, setOtp] = useState("");
  const otpRefs = useRef([]);

  const [maskedPhone, setMaskedPhone] = useState("");
  const [cooldown, setCooldown] = useState(0);

  const [channels, setChannels] = useState([]);
  const [lastChannel,setLastChannel] = useState(null);
  const [maskedEmail, setMaskedEmail] = useState("");

  const [successAnim, setSuccessAnim] = useState(false);
  const [expiry, setExpiry] = useState(300); // 5 minutes (300s)
  const [IdentifyingUser, setIdentifyingUser] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { loginWithToken } = useAuth();

  async function invokePublicFn(name, body) {
    const res = await supabase.functions.invoke(name, { body });
    const { data, error } = res || {};
    if (error || !data) {
      return { data: null, error: error || new Error("No response") };
    }
    return { data, error: null };
  }

  function getPostLoginTarget() {
    const redirect = searchParams.get("redirect");
    const serial = searchParams.get("serial");
    if (!redirect || !redirect.startsWith("/") || redirect.startsWith("//")) {
      return null;
    }
    try {
      const url = new URL(redirect, window.location.origin);
      if (serial) url.searchParams.set("serial", serial);
      return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return null;
    }
  }

  // 🔥 AUTO VERIFY WHEN 6 DIGITS ENTERED
  useEffect(() => {
    if (otp.length === 6 && !verifyingOtp && step === "otp") {
      handleVerifyOtp();
    }
  }, [otp]);

  // ⏱ Cooldown timer
  useEffect(() => {
    if (cooldown === 0) return;

    const timer = setInterval(() => {
      setCooldown((c) => c - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldown]);

  //OTP Expiry Countdown timer
  useEffect(() => {
    if (step !== "otp") return;

    setExpiry(300);

    const timer = setInterval(() => {
      setExpiry((t) => {
        if (t <= 1) {
          clearInterval(timer);

          setOtp("");
          setVerifyingOtp(false);
          setIdentifyingUser(false);
          setCooldown(0);
          setError("OTP expired. Please request a new one.");
          setStep("channel"); // 🔥 GO BACK ONE STEP
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [step]);

  useEffect(() => {
    if (step === "otp" && otpRefs.current[0]) {
      otpRefs.current[0].focus();
    }
  }, [step]);

  useEffect(() => {

    if (step !== "otp") return;
    if (!("OTPCredential" in window)) return;

    const ac = new AbortController();

    navigator.credentials
      .get({
        otp: { transport: ["sms"] },
        signal: ac.signal,
      })
      .then((credential) => {
        if (credential && credential.code) {
          setOtp(credential.code);
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.log("OTP auto-read failed:", err);
        }
      });

    return () => ac.abort();

  }, [step]);

  // ----------------------------
  // SEND OTP
  // ----------------------------
  async function handleIdentifyUser() {
    setError("");
    setErrorCode("");

    const ln = String(lastName || "").trim();
    const idn = String(idNumber || "").trim();

    if (!ln || !idn) {
      setError("Last name and ID number are required");
      return;
    }

    setIdentifyingUser(true);

    try {
      const { data, error: invokeError } = await invokePublicFn("identify-user", {
        last_name: ln,
        id_number: idn,
      });

      // 🔴 Transport / system error only
      if (invokeError || !data) {
        setError("Unable to send OTP. Please check your network connection.");
        return;
      }

      // 🟡 Business response (user not found, etc.)
      if (!data.success) {
        setError(data.message);
        setErrorCode(data.diag);
        return;
      }

      // ✅ Success
      setChannels(data.channels);
      setMaskedPhone(data.masked_phone);
      setMaskedEmail(data.masked_email);
      setUserId(data.user_id);
      setStep("channel");

    } catch (err) {
      console.error(err);
      setError("Unexpected error occurred");
    } finally {
      setIdentifyingUser(false);
    }
  }

  //-----------------------------
  // OTP Dispatch function
  //-----------------------------
  async function dispatchOtp(channel) {
  setError("");
  setErrorCode("");
  setIdentifyingUser(true);

  try {
    const { data, error: channelError } = await invokePublicFn("dispatch-otp", {
      user_id: userId,
      channel,
    });

    if (channelError || !data) {
      setError("Failed to dispatch OTP. Please check your nework connection.");
      return;
    }

    if (!data?.success){
      setErrorCode(data.diag);
      setError(data.message);
      return;
    }

    setLastChannel(channel);

    setStep("otp");
    setCooldown(30);
    setExpiry(300);        // ⏱ reset timer
    setOtp("");            // clear old OTP
    // loading is cleared in finally

  } catch (err) {
    console.error(err);
    setError("Unexpected error occurred");
  } finally {
    setIdentifyingUser(false);
  }
}
  // ----------------------------
  // VERIFY OTP
  // ----------------------------
  async function handleVerifyOtp() {

    if (expiry === 0) {
      setError("OTP expired. Request a new one.");
      return;
    }

    //prevents double submit
    if (verifyingOtp) return;

    setError("");
    setErrorCode("");

    if (otp.length !== 6) {
      setError("An OTP must be exactly 6-digits, re-check your OTP");
      return;
    }

    setVerifyingOtp(true);

    try {
      const { data, error: verifyError } = await invokePublicFn("verify-otp", {
        user_id: userId,
        otp,
      });

        //Supabse/network error
      if (verifyError && !data) {
        setError("OTP Verification failed. Please check your network connection.");
        return;
      }

      if(!data){
        setError("No response from server. Please try again");
        return;

      }

      //Back end business logic handling
    if (!data.success) {

      if (navigator.vibrate) {
        navigator.vibrate(200);
      }

      switch (data.code) {
        case "1":
          setError(data.message);
          setErrorCode(data.diag);
          setOtp("");
          break;

        case "2":
          // hard reset
          localStorage.removeItem("session");
          setStep("identity");
          setOtp("");
          setMaskedPhone("");
          setCooldown(0);
          setError(data.message);
          break;

        default:
          // Reset to the start of the flow without a hard reload.
          localStorage.removeItem("session");
          setStep("identity");
          setOtp("");
          setMaskedPhone("");
          setMaskedEmail("");
          setChannels([]);
          setCooldown(0);
          setExpiry(300);
          setError(data.message || "Login failed. Please try again.");
          setErrorCode(data.diag || "");
      
      }
      return;
    }
    // ✅ OTP verified successfully
    setSuccessAnim(true);

    // store session + update AuthContext
    await loginWithToken(data.session_token);
    
    // short success animation, then redirect
    setTimeout(() => {
      setSuccessAnim(false);
      const target = getPostLoginTarget();
      if (target) {
        navigate(target, { replace: true });
      } else {
        navigate("/redirect", { replace: true });
      }
    }, 3000);
    
    setOtp("");
    
    } catch (err) {
      console.error(err);
      setError("Unexpected error occurred");
    } finally {
      setVerifyingOtp(false);
    }
  }

  function handleOtpPaste(e) {
    e.preventDefault();

    const pasted = e.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);

    if (!pasted) return;

    // Fill OTP state
    setOtp(pasted);

    // Focus last filled box
    const lastIndex = pasted.length - 1;
    if (otpRefs.current[lastIndex]) {
      otpRefs.current[lastIndex].focus();
    }
  }

  function CountdownCircle({ seconds }) {
    const total = 300;
    const radius = 40;
    const stroke = 5;
    const normalized = radius - stroke * 2;
    const circumference = normalized * 2 * Math.PI;
    const progress = seconds / total;
    const offset = circumference - progress * circumference;

    const danger = seconds <= 30;

    return (
      <svg height="100" width="100">
        {/* Background */}
        <circle
          stroke="#e5e7eb"
          fill="transparent"
          strokeWidth={stroke}
          r={normalized}
          cx="50"
          cy="50"
        />

        {/* Progress */}
        <circle
          stroke={danger ? "#dc2626" : "#16a34a"} // 🔴 red when <30s
          fill="transparent"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          r={normalized}
          cx="50"
          cy="50"
          style={{
            transition: "stroke-dashoffset 1s linear, stroke 0.3s",
          }}
        />

        {/* Time */}
        <text
          x="50%"
          y="50%"
          dominantBaseline="middle"
          textAnchor="middle"
          className={`text-sm font-bold ${
            danger ? "fill-red-600" : "fill-gray-700"
          }`}
        >
          {Math.floor(seconds / 60)}:
          {(seconds % 60).toString().padStart(2, "0")}
        </text>
      </svg>
    );
  }

  function handleOtpClick(index) {
    const firstEmptyIndex = otp.length;

    // If user tries to click ahead of first empty box
    if (index > firstEmptyIndex) {
      if (otpRefs.current[firstEmptyIndex]) {
        otpRefs.current[firstEmptyIndex].focus();
      }
      return;
    }

    // Otherwise allow normal focus
    if (otpRefs.current[index]) {
      otpRefs.current[index].focus();
    }
  }

  return (
    <>

      {successAnim && (
        <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-white rounded-2xl shadow-xl px-8 py-6 flex flex-col items-center animate-scale-in">
            <div className="text-green-600 text-4xl mb-2">✅</div>
            <div className="text-lg font-semibold text-gray-800">
              You logged in successfully
            </div>
          </div>
        </div>
      )}

      <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
        <div className="bg-white w-full max-w-sm rounded-2xl shadow-lg p-6">
          <h1 className="text-2xl font-bold text-iregistrygreen mb-2">
            {step === "identity"
              ? "Login"
              : step === "channel"
              ? "Choose delivery method"
              : "Verify OTP"}
          </h1>

          <p className="text-sm text-gray-500 mb-4">
            {step === "identity"
              ? "Enter your details to receive a one-time code"
              : step === "otp"
              ? "Enter the OTP you received"
              : ""}
          </p>

          {error && (
            <div className="mb-4 text-sm text-red-600 bg-red-50 p-2 rounded">
              {errorCode && <strong>{errorCode}: </strong>}
              {error}
            </div>
          )}

          {step === "identity" && (
            <>
              <label className="block text-sm mb-1">Last name</label>
              <input
                className="w-full border rounded-lg px-4 py-2 mb-4"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />

              <label className="block text-sm mb-1">
                ID / Passport number
              </label>
              <input
                className="w-full border rounded-lg px-4 py-2 mb-3"
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
              />

              <div className="text-sm text-center mb-6">
                Don’t have an account?{" "}
                <button
                  type="button"
                  onClick={() => navigate("/signup")}
                  className="text-iregistrygreen font-semibold hover:underline"
                >
                  Create one here
                </button>
              </div>

              <button
                onClick={handleIdentifyUser}
                disabled={IdentifyingUser}
                className="w-full py-3 rounded-lg bg-iregistrygreen text-white font-semibold"
              >
                {IdentifyingUser ? "Sending..." : "Send OTP"}
              </button>
            </>
          )}

          {step === "channel" && (
            <>
              <p className="text-sm text-gray-500 mb-4">
                Choose how you want to receive your OTP
              </p>

              {channels.includes("sms") && (
                <button
                  onClick={() => dispatchOtp("sms")}
                  disabled={IdentifyingUser}
                  className="w-full py-3 mb-3 rounded-lg bg-iregistrygreen text-white font-semibold"
                >
                  SMS to {maskedPhone}
                </button>
              )}

              {channels.includes("email") && (
                <button
                  onClick={() => dispatchOtp("email")}
                  disabled={IdentifyingUser}
                  className="w-full py-3 rounded-lg border border-iregistrygreen text-iregistrygreen font-semibold"
                >
                  Email to {maskedEmail}
                </button>
              )}
            </>
          )}

          {step === "otp" && (
            <>

              <div className="flex justify-center mb-4">
                <CountdownCircle seconds={expiry} />
              </div>

              <div className="relative mb-6">

                <div className="flex justify-between mb-6">
                  {[0,1,2,3,4,5].map((i) => (
                    <input
                      key={i}
                      ref={(el) => (otpRefs.current[i] = el)}
                      className="w-12 h-12 text-center text-xl border rounded-lg transition-all duration-150
                      focus:ring-2 focus:ring-iregistrygreen focus:border-iregistrygreen focus:scale-105"
                      maxLength={1}
                      autoComplete={i === 0 ? "one-time-code" : "off"}
                      inputMode="numeric"
                      value={otp[i] || ""}
                      disabled={verifyingOtp}
                      onPaste={handleOtpPaste}
                      onClick={() => handleOtpClick(i)}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        const newOtp = otp.split("");
                        newOtp[i] = val;
                        setOtp(newOtp.join(""));

                        // auto move cursor
                        if (val && otpRefs.current[i + 1]) {
                          otpRefs.current[i + 1].focus();
                        }
                      }}

                      onKeyDown={(e) => {
                        if (e.key === "Backspace") {
                          e.preventDefault();

                          const newOtp = otp.split("");
                          
                          // Always clear current box
                          newOtp[i] = "";
                          setOtp(newOtp.join(""));

                          // Move to previous box if exists
                          if (otpRefs.current[i - 1]) {
                            otpRefs.current[i - 1].focus();
                            otpRefs.current[i - 1].select(); // highlight previous value
                          }
                        }
                      }}
                    />
                  ))}
                </div>

                {/* 🔄 Spinner inside input */}
                {verifyingOtp && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <svg
                      className="animate-spin h-5 w-5 text-gray-500"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v4l3-3-3-3v4a12 12 0 00-12 12h4z"
                      />
                    </svg>
                  </div>
                )}
              </div>

              <button
                onClick={handleVerifyOtp}
                disabled={verifyingOtp}
                className="w-full py-3 rounded-lg bg-iregistrygreen text-white font-semibold"
              >
                {verifyingOtp ? "Verifying..." : "Verify"}
              </button>

              <div className="text-center mt-3">
                <button
                  type="button"
                  onClick={() => {
                    setOtp("");
                    setError("");
                    setStep("channel");
                  }}
                  className="text-sm text-gray-500 hover:text-iregistrygreen hover:underline transition-colors"
                >
                  Change delivery method
                </button>
              </div>

              <div className="text-center mt-4 text-sm text-gray-500">
                {cooldown > 0 ? (
                  <>Resend OTP in {cooldown}s</>
                ) : (
                  <button
                    disabled = {!lastChannel || cooldown > 0 || verifyingOtp}
                    onClick={() => dispatchOtp(lastChannel)}
                  >
                    Resend OTP
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}