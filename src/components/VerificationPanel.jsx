// src/components/VerificationPanel.jsx
import React, { useState, useEffect } from "react";
import RippleButton from "./RippleButton.jsx";
import Tooltip from "./Tooltip.jsx";
import { useItemVerification } from "../hooks/useItemVerification";
import { useNotifyOwner } from "../hooks/useNotifyOwner";
import { ShieldAlert, Info } from "lucide-react";

export default function VerificationPanel() {
  const [serial, setSerial] = useState("");
  const [action, setAction] = useState(null);
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [notifyPolice, setNotifyPolice] = useState(false);

  const {
    result: verificationResult,
    verifying,
    error: verificationError,
    verify,
    reset,
  } = useItemVerification();

  const {
    notify,
    loading: notifying,
    success: notifySuccess,
    error: notifyError,
  } = useNotifyOwner();

  useEffect(() => {
    if (notifySuccess) {
      setMessage("");
      setContact("");
      setAction(null);
      setSerial("");
      setNotifyPolice(false);
      reset();
    }
  }, [notifySuccess, reset]);

  function handleVerify() {
    verify(serial);
  }

  return (
    <div className="bg-white rounded-3xl p-6 shadow-md mb-8">
      <div className="text-lg font-semibold text-gray-800 mb-4">
        Item Verification
      </div>

      {/* INPUT */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Enter Serial Number"
          value={serial}
          onChange={(e) => setSerial(e.target.value)}
          disabled={!!verificationResult}
          className={`flex-1 px-4 py-3 border rounded-2xl 
          focus:outline-none focus:ring-2 focus:ring-emerald-500
          ${verificationResult ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}
          `}
        />

        <RippleButton
          className={`px-6 py-2 rounded-xl font-semibold transition-all duration-300 ${
            verificationResult
              ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
              : "bg-emerald-600 text-white hover:bg-emerald-700"
          }`}
          onClick={() => {
            if (verificationResult) {
              reset();
              setAction(null);
              setNotifyPolice(false);
            } else {
              handleVerify();
            }
          }}
          disabled={!verificationResult && (verifying || !serial.trim())}
        >
          {verificationResult
            ? "Cancel & Search Again"
            : verifying
            ? "Checking..."
            : "Verify"}
        </RippleButton>
      </div>

      {/* LOADING */}
      {verifying && (
        <div className="mt-6 space-y-3 animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      )}

      {/* RESULT */}
      {!verifying && verificationResult && (
        <div className="mt-6 space-y-4">

          {verificationResult.state === "NOT_FOUND" && (
            <div className="text-gray-600">
              This item can not be found in iRegistry.
            </div>
          )}

          {verificationResult.state === "STOLEN" && (
            <>
              <div className="text-red-600 font-semibold">
                ⚠ This item has been reported stolen.
              </div>

              <label className="flex items-center gap-3 p-4 border rounded-2xl cursor-pointer hover:bg-gray-50 transition">
                <input
                  type="checkbox"
                  checked={action === "notify"}
                  onChange={(e) => {
                    if (e.target.checked) setAction("notify");
                    else {
                      setAction(null);
                      setNotifyPolice(false);
                    }
                  }}
                  className="accent-emerald-600 w-5 h-5"
                />
                <div>
                  <div className="font-medium text-gray-800">
                    Notify Registered Owner
                  </div>
                  <div className="text-sm text-gray-500">
                    Send message to the owner
                  </div>
                </div>
              </label>

              {action === "notify" && (
                <>
                  <label className="flex items-center gap-3 pl-8 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifyPolice}
                      onChange={(e) => setNotifyPolice(e.target.checked)}
                      className="accent-red-600 w-4 h-4"
                    />
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <span>Also inform law enforcement</span>
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-xs">
                        <ShieldAlert size={14} />
                        Police
                      </span>

                      <Tooltip
                        content={
                          <>
                            This will log the report for law enforcement visibility.
                            Your contact details may be used if authorities require follow-up.
                          </>
                        }
                      >
                        <Info size={14} className="text-gray-400 hover:text-gray-600 transition" />
                      </Tooltip>
                    </div>
                  </label>
                </>
              )}
            </>
          )}

          {verificationError && (
            <div className="text-red-600 text-sm">
              {verificationError}
            </div>
          )}

          {/* NOTIFY FORM */}
          {action === "notify" && (
            <div className="p-6 bg-white rounded-3xl shadow-lg border border-gray-200">
              <textarea
                placeholder="Write your message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full p-4 rounded-2xl border border-gray-300 bg-gray-50 mb-4"
              />

              <input
                type="text"
                placeholder="Your contact (phone or email)"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                className="w-full p-4 rounded-2xl border border-gray-300 bg-gray-50 mb-4"
              />

              <RippleButton
                className="w-full px-6 py-3 rounded-2xl bg-emerald-600 text-white font-semibold"
                onClick={() =>
                  notify({
                    serial,
                    message,
                    contact,
                    notifyPolice,
                  })
                }
                disabled={
                  notifying ||
                  !message.trim() ||
                  !contact.trim()
                }
              >
                {notifying ? "Sending..." : "Send Notification"}
              </RippleButton>

              {notifySuccess && (
                <div className="text-green-600 mt-3 text-sm">
                  ✅ Notification sent successfully.
                </div>
              )}

              {notifyError && (
                <div className="text-red-600 mt-3 text-sm">
                  {notifyError}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}