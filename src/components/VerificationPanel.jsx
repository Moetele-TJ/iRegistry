import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

// Components
import RippleButton from "./RippleButton";
import Tooltip from "./Tooltip";
import ConfirmModal from "./ConfirmModal";

// Hooks
import { useItemVerification } from "../hooks/useItemVerification";
import { useNotifyOwner } from "../hooks/useNotifyOwner";
import { usePhotoVerification } from "../hooks/usePhotoVerification";
import { useAuth } from "../contexts/AuthContext";

// Icons
import { ShieldAlert, Info, Camera } from "lucide-react";

// Utils
import { invokeWithAuth } from "../lib/invokeWithAuth";

export default function VerificationPanel() {
  // State
  const [serial, setSerial] = useState("");
  const [action, setAction] = useState(null);
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [notifyPolice, setNotifyPolice] = useState(false);
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState(false);
  const [transferError, setTransferError] = useState(null);
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  // Refs
  const videoRef = useRef(null);
  const resultRef = useRef(null);
  const autoCaptureRef = useRef(null);
  const lastFrameRef = useRef(null);

  // Context/Navigation
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  function goToLoginForTransfer() {
    const params = new URLSearchParams();
    params.set("redirect", "/");
    const trimmed = serial.trim();
    if (trimmed) params.set("serial", trimmed);
    navigate(`/login?${params.toString()}`);
  }

  // Hooks
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

  const {
    result: photoResult,
    verifying: verifyingPhoto,
    error: photoError,
    verifyPhoto,
    reset: resetPhoto,
  } = usePhotoVerification();

  // Derived
  const finalResult = photoResult || verificationResult;
  const verifyingAny = verifying || verifyingPhoto;

  // Effects
  useEffect(() => {
    if (notifySuccess) {
      setMessage("");
      setContact("");
      setAction(null);
      setSerial("");
      setNotifyPolice(false);
      reset();
      resetPhoto();
    }
  }, [notifySuccess, reset, resetPhoto]);

  useEffect(() => {
    const s = searchParams.get("serial");
    if (s) setSerial(s);
  }, [searchParams]);

  useEffect(() => {
    return () => {
      if (autoCaptureRef.current) {
        clearInterval(autoCaptureRef.current);
        autoCaptureRef.current = null;
      }
      const video = videoRef.current;
      const stream = video?.srcObject;
      if (stream) stream.getTracks().forEach(track => track.stop());
    };
  }, []);

  useEffect(() => {
    if (finalResult && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [finalResult]);

  useEffect(() => {
    if (finalResult) {
      setAction(null);
    }
  }, [finalResult]);

  // Handlers
  function handleVerify() {
    verify(serial);
  }

  async function openCamera() {
    setCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          startAutoCapture();
        };
      }
    } catch (err) {
      console.error("Camera access denied", err);
      setCameraOpen(false);
    }
  }

  function startAutoCapture() {
    const video = videoRef.current;
    autoCaptureRef.current = setInterval(() => {
      if (!video || video.videoWidth === 0) return;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0);
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      if (!lastFrameRef.current) {
        lastFrameRef.current = frame;
        return;
      }
      let diff = 0;
      for (let i = 0; i < frame.length; i += 50) {
        diff += Math.abs(frame[i] - lastFrameRef.current[i]);
      }
      lastFrameRef.current = frame;
      if (diff < 50000) {
        clearInterval(autoCaptureRef.current);
        capturePhoto();
      }
    }, 800);
  }

  async function capturePhoto() {
    if (!videoRef.current || !cameraOpen) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);
    const image = canvas.toDataURL("image/jpeg", 0.9);

    // Stop camera
    const stream = video.srcObject;
    if (stream) stream.getTracks().forEach(track => track.stop());
    clearInterval(autoCaptureRef.current);
    lastFrameRef.current = null;
    setCameraOpen(false);

    try {
      await verifyPhoto(image);
    } catch (err) {
      console.error("Photo verification failed", err);
    }
  }

  function closeCamera() {
    const video = videoRef.current;
    if (video?.srcObject) {
      video.srcObject.getTracks().forEach(track => track.stop());
    }
    clearInterval(autoCaptureRef.current);
    lastFrameRef.current = null;
    setCameraOpen(false);
  }

  async function handleSubmit() {
    if (action === "notify") {
      notify({
        serial,
        message,
        contact,
        notifyPolice,
      });
      return;
    }
    if (action === "transfer" && !user) {
      goToLoginForTransfer();
    }
  }

  async function executeTransfer() {
    if (!finalResult?.itemId) {
      setTransferError("Invalid item reference");
      return;
    }
    setTransferLoading(true);
    setTransferError(null);
    setTransferSuccess(false);
    try {
      const { data, error } = await invokeWithAuth("create-transfer-request", {
        body: { item_id: finalResult?.itemId, message: null },
      });
      if (error || !data?.success) throw new Error(data?.message || error?.message || "Transfer request failed");
      setTransferSuccess(true);
      setAction(null);
    } catch (err) {
      setTransferError(err.message);
    } finally {
      setTransferLoading(false);
    }
  }

  // Render
  return (
    <div className="relative bg-white rounded-3xl p-6 shadow-md mb-8">
      {/* Header */}
      <div className="text-lg font-semibold text-gray-800 mb-1">
        🛒 Buyer Protection Verification
      </div>
      <div className="text-sm text-gray-500 mb-4">
        🔎 Quick Safety Check - Check the item's serial number before buying to ensure it is not stolen.
      </div>
      {/* Input */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Enter Serial Number or take a photo"
            value={serial}
            onChange={e => setSerial(e.target.value)}
            disabled={!!finalResult}
            className={`w-full px-4 py-3 pr-12 border rounded-2xl bg-emerald-100 ring-1 ring-emerald-300
            focus:outline-none focus:ring-2 focus:ring-emerald-500
            ${finalResult ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""}
            `}
          />
          <button
            type="button"
            onClick={openCamera}
            disabled={verifyingPhoto}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-emerald-600 transition"
          >
            <Camera
              size={20}
              strokeWidth={2.2}
              className={verifyingPhoto ? "animate-pulse text-emerald-600" : ""}
            />
          </button>
        </div>
        <RippleButton
          className={`px-6 py-2 rounded-xl font-semibold transition-all duration-300 ${
            finalResult
              ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
              : "bg-emerald-600 text-white hover:bg-emerald-700"
          }`}
          onClick={() => {
            if (finalResult) {
              reset();
              resetPhoto();
              setAction(null);
              setNotifyPolice(false);
              setTransferSuccess(false);
              setTransferError(null);
            } else {
              handleVerify();
            }
          }}
          disabled={!finalResult && (verifyingAny || !serial.trim())}
        >
          {finalResult
            ? "Cancel & Search Again"
            : verifyingAny
            ? "Checking..."
            : "Verify"}
        </RippleButton>
      </div>
      <div className="text-xs text-gray-500 mt-2">
        You can usually find the serial number on the device label, packaging, or system settings.
      </div>
      {/* Loading State */}
      {verifyingAny && (
        <div className="mt-6 space-y-3 animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/2"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3"></div>
        </div>
      )}
      {/* Verification Result */}
      {!verifyingAny && finalResult && (
        <div ref={resultRef} className="mt-6 space-y-4">
          {/* Not Found */}
          {finalResult.state === "NOT_FOUND" && (
            <div className="p-5 rounded-2xl border border-gray-200 bg-gray-50">
              <div className="font-semibold text-gray-800 mb-2">
                ❓ Item Not Found in Registry
              </div>
              <div className="text-sm text-gray-600">
                This item is not currently registered in iRegistry.
                This does not necessarily mean the item is safe.
              </div>
              <div className="text-sm text-gray-600 mt-2">
                Ask the seller to provide proof of ownership before purchasing.
              </div>
            </div>
          )}
          {/* Registered */}
          {finalResult.state === "REGISTERED" && (
            <>
              <div className="p-5 rounded-2xl border border-emerald-200 bg-emerald-50">
                <div className="text-emerald-700 font-semibold mb-1">
                  ✅ Item Found in Registry
                </div>
                <div className="text-sm text-emerald-800">
                  This item is fully registered for another customer.
                </div>
                <div className="text-sm text-gray-700 mt-1">
                  Ask the seller to provide proof of ownership before purchasing.
                </div>
              </div>
              <div className="space-y-4">
                {/* Notify Owner Option */}
                <label className="flex items-center gap-3 p-4 border rounded-2xl cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={action === "notify"}
                    onChange={e => setAction(e.target.checked ? "notify" : null)}
                    className="accent-emerald-600 w-5 h-5"
                  />
                  <div>
                    <div className="font-medium text-gray-800">
                      Notify Registered Owner
                    </div>
                    <div className="text-sm text-gray-500">
                      Send them a direct message
                    </div>
                  </div>
                </label>
                {/* Request Transfer Option */}
                <label
                  className={`flex items-center gap-3 p-4 border rounded-2xl transition ${
                    user
                      ? "cursor-pointer hover:bg-gray-50"
                      : "cursor-not-allowed bg-gray-50 opacity-60"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={action === "transfer"}
                    disabled={!user}
                    onChange={e => setAction(e.target.checked ? "transfer" : null)}
                    className="accent-blue-600 w-5 h-5"
                  />
                  <div>
                    <div className="font-medium text-gray-800">
                      Request Ownership Transfer
                    </div>
                    <div className="text-sm text-gray-500">
                      {user
                        ? "Ask the registered owner to transfer this item to you"
                        : "Login required to request transfer"}
                    </div>
                    {!user && (
                      <button
                        type="button"
                        onClick={goToLoginForTransfer}
                        className="text-xs text-blue-600 hover:underline mt-1"
                      >
                        Click here to login
                      </button>
                    )}
                  </div>
                </label>
              </div>
            </>
          )}
          {/* Stolen */}
          {finalResult.state === "STOLEN" && (
            <>
              <div className="p-5 rounded-2xl border border-red-300 bg-red-50">
                <div className="text-red-700 font-semibold mb-2">
                  ⚠ WARNING: Stolen Item
                </div>
                <div className="text-sm text-red-800">
                  This item has been reported stolen by the registered owner.
                </div>
                <div className="text-sm text-red-800 mt-1 font-medium">
                  Do NOT purchase this item.
                </div>
              </div>
              <div
                className={`border rounded-2xl transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]
                  ${action === "notify"
                    ? "scale-[1.01] border-emerald-300 bg-emerald-50/40 shadow-[0_0_0_2px_rgba(16,185,129,0.2)]"
                    : "scale-100 border-gray-200 bg-white"}
                `}
              >
                <label
                  className={`flex items-center rounded-tr-2xl rounded-tl-2xl gap-3 p-4 cursor-pointer transition-all duration-300
                    ${action === "notify"
                      ? "border-l-4 border-emerald-500 bg-white"
                      : "border-l-4 border-transparent hover:bg-gray-50"}
                  `}
                >
                  <input
                    type="checkbox"
                    checked={action === "notify"}
                    onChange={e => {
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
                  <label className="flex items-center gap-3 pl-12 pr-4 pb-4 cursor-pointer hover:bg-gray-50 transition">
                    <input
                      type="checkbox"
                      checked={notifyPolice}
                      onChange={e => setNotifyPolice(e.target.checked)}
                      className="accent-red-600 w-4 h-4"
                    />
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <span>Also inform law enforcement</span>
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-600 text-xs font-medium">
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
                )}
              </div>
            </>
          )}
          {/* Error State */}
          {(verificationError || photoError) && (
            <div className="text-red-600 mt-4 text-sm">
              {verificationError || photoError}
            </div>
          )}
          {/* Notify Form */}
          {action === "notify" && (
            <div
              className={`
                transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] overflow-hidden
                max-h-[600px] opacity-100 translate-y-0 mt-6
              `}
            >
              <div className="p-6 bg-white rounded-3xl shadow-lg border border-gray-200">
                <textarea
                  placeholder="Write your message..."
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  className="w-full p-4 rounded-2xl border border-gray-300 bg-gray-50 
                  focus:bg-white focus:ring-2 focus:ring-emerald-500 
                  focus:border-emerald-500 transition-all duration-200 shadow-sm mb-4"
                />
                <input
                  type="text"
                  placeholder="Your contact (phone or email)"
                  value={contact}
                  onChange={e => setContact(e.target.value)}
                  className="w-full p-4 rounded-2xl border border-gray-300 bg-gray-50 
                  focus:bg-white focus:ring-2 focus:ring-emerald-500 
                  focus:border-emerald-500 transition-all duration-200 shadow-sm mb-4"
                />
                <RippleButton
                  className="w-full px-6 py-3 rounded-2xl 
                  bg-emerald-600 text-white font-semibold 
                  shadow-md hover:shadow-xl hover:bg-emerald-700 
                  transition-all duration-300 disabled:opacity-50"
                  onClick={handleSubmit}
                  disabled={
                    notifying ||
                    !message.trim() ||
                    !contact.trim()
                  }
                >
                  {notifying ? "Sending..." : "Submit"}
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
            </div>
          )}
          {/* Transfer */}
          {action === "transfer" && (
            <div className="mt-6 p-6 bg-white rounded-3xl shadow-lg border border-gray-200">
              <p className="text-sm text-gray-600 mb-4">
                You are requesting the registered owner to transfer this item to you.
                You must be logged in to proceed.
              </p>
              <RippleButton
                className="w-full px-6 py-3 rounded-2xl 
                bg-blue-600 text-white font-semibold 
                hover:bg-blue-700 transition-all duration-300 disabled:opacity-50"
                onClick={() => setShowTransferConfirm(true)}
                disabled={transferLoading}
              >
                {transferLoading ? "Submitting..." : "Request Ownership Transfer"}
              </RippleButton>
              {transferSuccess && (
                <div className="text-green-600 mt-3 text-sm">
                  ✅ Transfer request submitted successfully.
                </div>
              )}
              {transferError && (
                <div className="text-red-600 mt-3 text-sm">
                  {transferError}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={showTransferConfirm}
        onClose={() => setShowTransferConfirm(false)}
        onConfirm={async () => {
          setShowTransferConfirm(false);
          await executeTransfer();
        }}
        title="Confirm Transfer Request"
        message="Are you sure you want to request ownership transfer for this item?"
        confirmLabel="Yes, Request Transfer"
        cancelLabel="Cancel"
      />
      {/* Camera Overlay */}
      {cameraOpen && (
        <div className="fixed inset-0 z-[999] bg-black flex flex-col items-center justify-center">
          <div className="relative w-full h-full flex items-center justify-center">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[70%] h-[55%] border-2 border-emerald-400 rounded-lg relative">
                <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-emerald-400"></div>
                <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-emerald-400"></div>
                <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-emerald-400"></div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-emerald-400"></div>
                <div className="absolute left-0 w-full h-[2px] bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.8)] animate-scan"></div>
              </div>
            </div>
          </div>
          <div className="text-white text-sm mt-4">
            Center the item — Photo will be captured automatically or tap "Capture".
          </div>
          <div className="flex gap-4 mt-6">
            <RippleButton
              className="px-6 py-3 bg-emerald-600 text-white rounded-xl"
              onClick={capturePhoto}
            >
              Capture
            </RippleButton>
            <RippleButton
              className="px-6 py-3 bg-gray-300 text-gray-800 rounded-xl"
              onClick={closeCamera}
            >
              Cancel
            </RippleButton>
          </div>
        </div>
      )}
      {/* Photo Verifying Overlay */}
      {verifyingPhoto && !cameraOpen && (
        <div className="absolute inset-0 z-30 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center rounded-3xl">
          <div className="animate-spin w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full mb-4"></div>
          <div className="text-gray-700 font-medium">Analyzing photo...</div>
          <div className="text-xs text-gray-500 mt-1">Searching registry for matching items</div>
        </div>
      )}
      <hr className="my-6 border-gray-200" />
      <div className="text-xs text-gray-400 text-center">
        Verifying an item protects you from buying stolen property and helps owners recover lost items.
      </div>
    </div>
  );
}