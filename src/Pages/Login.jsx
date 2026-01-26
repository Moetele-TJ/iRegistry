// src/Pages/Login.jsx

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import Header from "../components/Header.jsx";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

export default function Login() {
  const [step, setStep] = useState("identity"); // identity | otp | channel
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");

  const [lastName, setLastName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [otp, setOtp] = useState("");

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
  const { loginWithToken } = useAuth();

  // 🔥 AUTO VERIFY WHEN 6 DIGITS ENTERED
  //useEffect(() => {
    //if (otp.length === 6 && !verifyingOtp) {
      //handleVerifyOtp();
    //}
  //}, [otp, verifyingOtp]);

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

  // ----------------------------
  // SEND OTP
  // ----------------------------
  async function handleIdentifyUser() {
    setError("");
    setErrorCode("");

    if (!lastName || !idNumber) {
      setError("Last name and ID number are required");
      return;
    }

    setIdentifyingUser(true);

    try {
      const { data, error : invokeError } = await supabase.functions.invoke("identify-user", {
        body: {
          last_name: lastName,
          id_number: idNumber,
        },
      });

      // 🔴 Transport / system error only
      if (invokeError||!data){
        setError("Unable to send OTP. Please try again.");
        setIdentifyingUser(false);
        return;
      }

      // 🟡 Business response (user not found, etc.)
      if (!data.success) {
        setError(data.message);
        setErrorCode(data.diag);
        setIdentifyingUser(false);
        return;
      }

      // ✅ Success
      setChannels(data.channels);
      setMaskedPhone(data.masked_phone);
      setMaskedEmail(data.masked_email);
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
    const { data, error : ChannelError } = await supabase.functions.invoke("dispatch-otp", {
      body: { id_number: idNumber, channel },
    });

    if ( ChannelError || !data ) {
      setError("Failed to dispatch OTP. Please try again.");
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
    setIdentifyingUser(false);     // ensure loading is off

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
      const { data, error : verifyError } = await supabase.functions.invoke("verify-otp", {
        body: {
          id_number: idNumber,
          otp,
        },
      });
        //Supabse/network error
      if(verifyError||!data){
        setVerifyingOtp(false);
        setError("OTP Verification failed. Please try again");
        return;
      }
      //Back end business logic handling
    if (!data.success) {

      if (navigator.vibrate) {
        navigator.vibrate(200);
      }

      setVerifyingOtp(false);

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
          window.location.href = "/login"
      
      }
      return;
    }
    // ✅ OTP verified successfully
    setSuccessAnim(true);

    // store session + update AuthContext
    loginWithToken(data.session_token, data.role);

    // short success animation, then redirect
    setTimeout(() => {
      setSuccessAnim(false);
      navigate("/redirect", { replace: true });
    }, 2000);

    setOtp("");
    
    } catch (err) {
      console.error(err);
      setError("Unexpected error occurred");
    } finally {
      setVerifyingOtp(false);
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

  return (
    <>
      <Header />

      {successAnim && (
        <div className="fixed inset-0 bg-green-500 flex items-center justify-center text-white text-3xl font-bold z-50">
          ✅ Verified!
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
                onChange={(e) => setLastName(e.target.value.trim())}
              />

              <label className="block text-sm mb-1">
                ID / Passport number
              </label>
              <input
                className="w-full border rounded-lg px-4 py-2 mb-6"
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value.trim())}
              />

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
                      className="w-12 h-12 text-center text-xl border rounded-lg"
                      maxLength={1}
                      value={otp[i] || ""}
                      disabled={verifyingOtp}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        const newOtp = otp.split("");
                        newOtp[i] = val;
                        setOtp(newOtp.join(""));

                        // auto move cursor
                        if (val && e.target.nextSibling) {
                          e.target.nextSibling.focus();
                        }
                      }}

                      onKeyDown={(e) => {
                        if (e.key === "Backspace" && !otp[i] && e.target.previousSibling) {
                          e.target.previousSibling.focus();
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