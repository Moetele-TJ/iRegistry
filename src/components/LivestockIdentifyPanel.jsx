import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Search } from "lucide-react";
import RippleButton from "./RippleButton.jsx";
import { invokeFn } from "../lib/invokeFn.js";
import { invokeWithAuth } from "../lib/invokeWithAuth.js";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useToast } from "../contexts/ToastContext.jsx";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

function photoSrc(p) {
  if (!p) return null;
  if (typeof p === "string") {
    if (p.startsWith("http")) return p;
    return `${SUPABASE_URL}/storage/v1/object/public/item-photos/${p}`;
  }
  const path = p.thumb || p.original || p.path;
  if (!path) return null;
  if (String(path).startsWith("http")) return path;
  return `${SUPABASE_URL}/storage/v1/object/public/item-photos/${path}`;
}

function getPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy_m: pos.coords.accuracy,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
    );
  });
}

/**
 * Public Livestock identify: photo or ear-tag/brand → shortlist → pick → sighting.
 */
export default function LivestockIdentifyPanel() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [mode, setMode] = useState("photo"); // photo | text
  const [query, setQuery] = useState("");
  const [textMode, setTextMode] = useState("any");
  const [busy, setBusy] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [matches, setMatches] = useState([]);
  const [geo, setGeo] = useState(null);
  const [geoAsked, setGeoAsked] = useState(false);
  const [pickedId, setPickedId] = useState(null);
  const [lastImageUrl, setLastImageUrl] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const videoRef = useRef(null);
  const fileRef = useRef(null);

  const askGeo = useCallback(async () => {
    setGeoAsked(true);
    const g = await getPosition();
    setGeo(g);
    if (!g) {
      addToast({
        type: "info",
        message: "Location not available. You can still search; the owner will not get a distance.",
      });
    }
    return g;
  }, [addToast]);

  useEffect(() => {
    return () => {
      const stream = videoRef.current?.srcObject;
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function openCamera() {
    try {
      if (!geoAsked) await askGeo();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      setCameraOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      addToast({ type: "error", message: "Could not open camera." });
    }
  }

  function closeCamera() {
    const stream = videoRef.current?.srcObject;
    if (stream) stream.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOpen(false);
  }

  async function runPhotoSearch(dataUrl, width, height) {
    setBusy(true);
    setMatches([]);
    setPickedId(null);
    try {
      if (!geoAsked) await askGeo();
      setLastImageUrl(dataUrl);
      const invoker = user ? invokeWithAuth : invokeFn;
      const { data, error } = await invoker("livestock-api", {
        body: {
          operation: "livestock-search-photo",
          imageUrl: dataUrl,
          width,
          height,
        },
      });
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || "Photo search failed");
      }
      setSessionId(data.session_id || null);
      setMatches(Array.isArray(data.matches) ? data.matches : []);
      if (!data.found) {
        addToast({ type: "info", message: "No strong livestock match found." });
      }
    } catch (e) {
      addToast({ type: "error", message: e?.message || "Photo search failed" });
    } finally {
      setBusy(false);
    }
  }

  async function captureFromCamera() {
    const video = videoRef.current;
    if (!video) return;
    const w = video.videoWidth || 0;
    const h = video.videoHeight || 0;
    if (w < 480 || h < 480) {
      addToast({
        type: "error",
        message: "Photo is too low resolution. Move closer and try again.",
      });
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    closeCamera();
    await runPhotoSearch(dataUrl, w, h);
  }

  async function onFileSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
      if (img.naturalWidth < 480 || img.naturalHeight < 480) {
        addToast({
          type: "error",
          message: "Photo is too low resolution. Choose a clearer photo.",
        });
        URL.revokeObjectURL(url);
        return;
      }
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d").drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
      URL.revokeObjectURL(url);
      await runPhotoSearch(dataUrl, img.naturalWidth, img.naturalHeight);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      addToast({ type: "error", message: "Could not read that image." });
    };
    img.src = url;
  }

  async function runTextSearch() {
    const q = query.trim();
    if (q.length < 2) {
      addToast({ type: "error", message: "Enter at least 2 characters." });
      return;
    }
    setBusy(true);
    setMatches([]);
    setPickedId(null);
    try {
      if (!geoAsked) await askGeo();
      const invoker = user ? invokeWithAuth : invokeFn;
      const { data, error } = await invoker("livestock-api", {
        body: {
          operation: "livestock-search-text",
          query: q,
          mode: textMode,
        },
      });
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || "Search failed");
      }
      setSessionId(data.session_id || null);
      setMatches(Array.isArray(data.matches) ? data.matches : []);
      if (!data.found) {
        addToast({ type: "info", message: "No matching animals found." });
      }
    } catch (e) {
      addToast({ type: "error", message: e?.message || "Search failed" });
    } finally {
      setBusy(false);
    }
  }

  async function pickMatch(animalId) {
    setBusy(true);
    try {
      const g = geo || (await askGeo());
      const invoker = user ? invokeWithAuth : invokeFn;
      const source =
        mode === "photo" ? "photo" : textMode === "brand" ? "brand" : textMode === "ear_tag" ? "ear_tag" : "ear_tag";
      const { data, error } = await invoker("livestock-api", {
        body: {
          operation: "livestock-pick-sighting",
          animal_id: animalId,
          session_id: sessionId,
          source: mode === "photo" ? "photo" : source,
          query_text: mode === "text" ? query.trim() : null,
          lat: g?.lat ?? null,
          lng: g?.lng ?? null,
          accuracy_m: g?.accuracy_m ?? null,
          sighting_photos: lastImageUrl ? [{ original: lastImageUrl }] : [],
        },
      });
      if (error || !data?.success) {
        throw new Error(data?.message || error?.message || "Failed to report sighting");
      }
      setPickedId(animalId);
      addToast({
        type: "success",
        message: "Thanks — the owner has been notified of this possible sighting.",
      });
    } catch (e) {
      addToast({ type: "error", message: e?.message || "Failed to report sighting" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Photograph an animal or search by ear tag / brand. We only show strong matches. Location helps the
        owner know if their animal is astray (distance only — not your exact pin on the alert).
      </p>

      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          className={`px-3 py-1.5 rounded-xl border text-sm font-medium ${
            mode === "photo" ? "bg-iregistrygreen text-white border-iregistrygreen" : "bg-white text-gray-700"
          }`}
          onClick={() => setMode("photo")}
        >
          Photo
        </button>
        <button
          type="button"
          className={`px-3 py-1.5 rounded-xl border text-sm font-medium ${
            mode === "text" ? "bg-iregistrygreen text-white border-iregistrygreen" : "bg-white text-gray-700"
          }`}
          onClick={() => setMode("text")}
        >
          Ear tag / brand
        </button>
        <RippleButton
          type="button"
          className="px-3 py-1.5 rounded-xl border bg-white text-sm"
          onClick={() => void askGeo()}
          disabled={busy}
        >
          {geo ? "Location ready" : "Allow location"}
        </RippleButton>
      </div>

      {mode === "photo" ? (
        <div className="flex flex-wrap gap-2">
          <RippleButton
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-iregistrygreen text-white text-sm"
            onClick={() => void openCamera()}
            disabled={busy}
          >
            <Camera size={16} />
            Take photo
          </RippleButton>
          <RippleButton
            type="button"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border bg-white text-sm"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            Upload photo
          </RippleButton>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => void onFileSelected(e)}
          />
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <select
              className="border rounded-xl px-3 py-2 text-sm bg-white"
              value={textMode}
              onChange={(e) => setTextMode(e.target.value)}
            >
              <option value="any">Ear tag or brand</option>
              <option value="ear_tag">Ear tag only</option>
              <option value="brand">Brand only</option>
            </select>
            <input
              className="flex-1 min-w-[12rem] border rounded-xl px-3 py-2 text-sm"
              placeholder="Enter ear tag or brand…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void runTextSearch();
              }}
            />
            <RippleButton
              type="button"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-iregistrygreen text-white text-sm"
              onClick={() => void runTextSearch()}
              disabled={busy}
            >
              <Search size={16} />
              Search
            </RippleButton>
          </div>
        </div>
      )}

      {busy ? <div className="text-sm text-gray-500">Searching…</div> : null}

      {matches.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">Possible matches — pick the best</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {matches.map((m) => {
              const src = photoSrc(m.photos?.[0]);
              const selected = pickedId === m.id;
              return (
                <div
                  key={m.id}
                  className={`rounded-2xl border overflow-hidden bg-white ${
                    selected ? "border-emerald-500 ring-2 ring-emerald-200" : "border-gray-200"
                  }`}
                >
                  <div className="aspect-[4/3] bg-gray-100">
                    {src ? (
                      <img src={src} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">
                        No photo
                      </div>
                    )}
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="text-xs text-gray-600">
                      {[m.type_code, m.colour, m.breed].filter(Boolean).join(" · ") || "Registered animal"}
                      {m.similarity != null ? (
                        <span className="ml-2 tabular-nums text-gray-400">
                          {(Number(m.similarity) * 100).toFixed(0)}%
                        </span>
                      ) : null}
                    </div>
                    <RippleButton
                      type="button"
                      className="w-full px-3 py-2 rounded-xl bg-amber-500 text-white text-sm font-semibold disabled:opacity-60"
                      disabled={busy || Boolean(pickedId)}
                      onClick={() => void pickMatch(m.id)}
                    >
                      {selected ? "Reported" : "This is the best match"}
                    </RippleButton>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {cameraOpen ? (
        <div className="fixed inset-0 z-[80] flex flex-col bg-black/80 p-4">
          <video ref={videoRef} playsInline muted className="flex-1 w-full object-contain rounded-xl bg-black" />
          <div className="mt-3 flex justify-center gap-3">
            <RippleButton
              type="button"
              className="px-4 py-2 rounded-xl bg-white text-sm"
              onClick={closeCamera}
            >
              Cancel
            </RippleButton>
            <RippleButton
              type="button"
              className="px-4 py-2 rounded-xl bg-iregistrygreen text-white text-sm"
              onClick={() => void captureFromCamera()}
            >
              Capture
            </RippleButton>
          </div>
        </div>
      ) : null}
    </div>
  );
}
