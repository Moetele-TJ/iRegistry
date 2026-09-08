import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import RippleButton from "../../components/RippleButton.jsx";
import BillingCostBanner from "../../components/BillingCostBanner.jsx";
import { invokeWithAuth } from "../../lib/invokeWithAuth.js";
import { useToast } from "../../contexts/ToastContext.jsx";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useModal } from "../../contexts/ModalContext.jsx";
import { useUserSidebar } from "../../hooks/useUserSidebar.jsx";
import { putSignedUpload } from "../../lib/putSignedUpload.js";
import {
  formatInsufficientCreditsMessage,
  isPrivilegedRole,
  USER_TOPUP_PATH,
  POLICE_TOPUP_PATH,
} from "../../lib/billingUx.js";
import { roleIs } from "../../lib/roleUtils.js";
import { displayUser } from "../../lib/userDisplay.js";
import { useTaskPricing } from "../../hooks/useTaskPricing.js";
import BrandOrientationField from "../../components/BrandOrientationField.jsx";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const PACK_TASK = "LIVESTOCK_REGISTER_PACK";
const FREE_LIFETIME = 2;

function topupPathForRole(role) {
  if (roleIs(role, "police")) return POLICE_TOPUP_PATH;
  return USER_TOPUP_PATH;
}

export default function UserLivestockRegisterPage() {
  const { user } = useAuth();
  const isUserRole = roleIs(user?.role, "user");
  useUserSidebar({ visible: isUserRole });
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { addToast } = useToast();
  const { confirm } = useModal();
  const { getCost } = useTaskPricing();
  const ownerFromQuery = searchParams.get("owner") || "";
  const registerOwnerId =
    isPrivilegedRole(user?.role) && ownerFromQuery
      ? ownerFromQuery
      : user?.id != null
        ? String(user.id)
        : "";

  const registeringForOther =
    isPrivilegedRole(user?.role) &&
    ownerFromQuery &&
    ownerFromQuery !== String(user?.id);

  const labelFromNav = String(location.state?.registerForOwnerLabel || "").trim();
  const [ownerLabel, setOwnerLabel] = useState(labelFromNav || "");

  useEffect(() => {
    if (!registeringForOther || !ownerFromQuery) {
      setOwnerLabel("");
      return;
    }
    if (labelFromNav) {
      setOwnerLabel(labelFromNav);
      return;
    }
    let cancelled = false;
    setOwnerLabel("");
    void (async () => {
      const { data } = await invokeWithAuth("get-user-profile", {
        body: { user_id: ownerFromQuery },
      });
      if (cancelled || !data?.success || !data.user) return;
      const label = displayUser(data.user);
      if (label) setOwnerLabel(label);
    })();
    return () => {
      cancelled = true;
    };
  }, [registeringForOther, ownerFromQuery, labelFromNav]);

  const listBack = roleIs(user?.role, "admin")
    ? "/admin/livestock"
    : roleIs(user?.role, "cashier")
      ? "/cashier/livestock"
      : roleIs(user?.role, "police")
        ? "/police/livestock"
        : "/user/livestock";

  const [vocab, setVocab] = useState({ types: [], colours: [], ear_mark_types: [] });
  const [saving, setSaving] = useState(false);
  const [files, setFiles] = useState([]);
  const [packInfo, setPackInfo] = useState(null);

  const [type_code, setTypeCode] = useState("cattle");
  const [gender, setGender] = useState("unknown");
  const [breed, setBreed] = useState("");
  const [colour, setColour] = useState("");
  const [name, setName] = useState("");
  const [zone_brand, setZoneBrand] = useState("");
  const [dwelling_village, setDwellingVillage] = useState("");
  const [dwelling_lat, setDwellingLat] = useState("");
  const [dwelling_lng, setDwellingLng] = useState("");
  const [brands, setBrands] = useState([]);
  const [earTags, setEarTags] = useState([{ tag_id: "", side: "left" }]);
  const [earMarks, setEarMarks] = useState([]);

  const selectedType = useMemo(
    () => (vocab.types || []).find((t) => t.code === type_code),
    [vocab.types, type_code],
  );
  const brandBearing = Boolean(selectedType?.brand_bearing);

  const packCost = useMemo(() => {
    const n = getCost(PACK_TASK);
    return typeof n === "number" && Number.isFinite(n) ? n : 5;
  }, [getCost]);

  const needsPack = Boolean(packInfo && !packInfo.can_register && packInfo.needs_pack);
  const packInUse = Number(packInfo?.pack?.lifetime_registered ?? 0) >= 3;

  const refreshPack = useCallback(async () => {
    if (!registerOwnerId || registeringForOther) {
      setPackInfo(null);
      return;
    }
    const { data } = await invokeWithAuth("livestock-api", {
      body: {
        operation: "livestock-get-pack-status",
        owner_id: registerOwnerId,
      },
    });
    if (data?.success) {
      setPackInfo({
        pack: data.pack,
        can_register: data.can_register,
        needs_pack: data.needs_pack,
        reason: data.reason,
      });
    }
  }, [registerOwnerId, registeringForOther]);

  useEffect(() => {
    void (async () => {
      const { data } = await invokeWithAuth("livestock-api", {
        body: { operation: "livestock-get-vocab" },
      });
      if (data?.success) {
        setVocab({
          types: data.types || [],
          colours: data.colours || [],
          ear_mark_types: data.ear_mark_types || [],
        });
        if (data.types?.[0]?.code) setTypeCode(data.types[0].code);
      }
    })();
  }, []);

  useEffect(() => {
    void refreshPack();
  }, [refreshPack]);

  const captureDwelling = useCallback(() => {
    if (!navigator.geolocation) {
      addToast({ type: "error", message: "Geolocation not available on this device." });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDwellingLat(String(pos.coords.latitude));
        setDwellingLng(String(pos.coords.longitude));
        addToast({ type: "success", message: "Dwelling coordinates captured." });
      },
      () => addToast({ type: "error", message: "Could not get location." }),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }, [addToast]);

  async function ensurePackSlot() {
    if (registeringForOther) return true;
    await refreshPack();
    const { data } = await invokeWithAuth("livestock-api", {
      body: {
        operation: "livestock-get-pack-status",
        owner_id: registerOwnerId || undefined,
      },
    });
    if (data?.can_register) return true;

    const balance = Number(user?.credit_balance ?? 0);
    const baseMsg = `Your first ${FREE_LIFETIME} animal registrations are free. To register another animal you need a registration pack (10 animals), which costs at least ${packCost} credits.`;

    if (balance < packCost) {
      const goTopup = await confirm({
        title: "Recharge your account",
        message: formatInsufficientCreditsMessage(
          `${baseMsg} Please recharge your account, then try again.`,
          { taskCode: PACK_TASK, creditsCost: packCost, balance },
        ),
        confirmLabel: "Go to top-up",
        cancelLabel: "Cancel",
        variant: "warning",
      }).catch(() => false);
      if (goTopup) navigate(topupPathForRole(user?.role));
      return false;
    }

    const buy = await confirm({
      title: "Registration pack required",
      message: `${baseMsg} Your balance: ${balance} credits. Buy a pack to continue?`,
      confirmLabel: `Buy pack (${packCost} credits)`,
      cancelLabel: "Cancel",
      variant: "warning",
    }).catch(() => false);
    if (!buy) return false;

    const buyRes = await invokeWithAuth("livestock-api", {
      body: { operation: "livestock-buy-pack" },
    });
    if (buyRes.error || !buyRes.data?.success) {
      addToast({
        type: "error",
        message: formatInsufficientCreditsMessage(
          buyRes.data?.message || buyRes.error?.message || "Could not buy registration pack.",
          { taskCode: PACK_TASK, creditsCost: packCost, balance },
        ),
      });
      return false;
    }
    addToast({ type: "success", message: "Registration pack unlocked (10 animals)." });
    await refreshPack();
    return true;
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (!files.length) {
      addToast({ type: "error", message: "Add at least one clear photo." });
      return;
    }
    if (!dwelling_lat || !dwelling_lng) {
      addToast({
        type: "error",
        message: "Capture dwelling location so we can send distance alerts on sightings.",
      });
      return;
    }

    setSaving(true);
    try {
      const ok = await ensurePackSlot();
      if (!ok) return;

      const signRes = await invokeWithAuth("livestock-api", {
        body: {
          operation: "livestock-sign-uploads",
          files: files.map((f) => ({ contentType: f.type || "image/jpeg" })),
        },
      });
      if (signRes.error || !signRes.data?.success) {
        throw new Error(signRes.data?.message || "Failed to prepare uploads");
      }
      const uploads = signRes.data.uploads || [];
      const photos = [];
      for (let i = 0; i < uploads.length; i++) {
        const u = uploads[i];
        const file = files[i];
        await putSignedUpload(u.signedUrl, file);
        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/item-photos/${u.path}`;
        photos.push({ original: u.path, thumb: u.path, url: publicUrl });
      }

      const { data, error } = await invokeWithAuth("livestock-api", {
        body: {
          operation: "livestock-register",
          owner_id: registerOwnerId || undefined,
          type_code,
          gender,
          breed: breed.trim() || null,
          colour: colour.trim() || null,
          name: name.trim() || null,
          zone_brand: brandBearing ? zone_brand.trim() || null : null,
          dwelling_lat: Number(dwelling_lat),
          dwelling_lng: Number(dwelling_lng),
          dwelling_village: dwelling_village.trim() || null,
          photos,
          brands: brandBearing
            ? brands.filter((b) => b.characters?.trim()).map((b) => ({
              characters: b.characters.trim(),
              layout: b.layout,
              side: b.side,
              body_part: b.body_part,
            }))
            : [],
          ear_tags: earTags.filter((t) => t.tag_id?.trim()),
          ear_marks: earMarks.filter((m) => m.mark_label?.trim()),
        },
      });

      if (error || !data?.success) {
        if (data?.code === "NEED_PACK" || data?.billing?.required) {
          const balance = Number(user?.credit_balance ?? 0);
          throw new Error(
            formatInsufficientCreditsMessage(
              data?.message ||
                `You need at least ${packCost} credits for a registration pack. Please recharge your account.`,
              { taskCode: PACK_TASK, creditsCost: packCost, balance },
            ),
          );
        }
        throw new Error(data?.message || error?.message || "Registration failed");
      }

      const animalId = data.animal?.id;
      if (animalId) {
        for (const p of photos) {
          void invokeWithAuth("livestock-api", {
            body: {
              operation: "livestock-store-embedding",
              animal_id: animalId,
              photo_path: p.original,
              imageUrl: p.url,
            },
          });
        }
      }

      addToast({ type: "success", message: "Animal registered." });
      navigate(`/livestock/${data.animal.id}`);
    } catch (err) {
      addToast({ type: "error", message: err?.message || "Registration failed" });
    } finally {
      setSaving(false);
    }
  }

  const forCustomer = Boolean(registeringForOther);
  const customerLabel = ownerLabel || "the selected user";

  const headerSubtitle = forCustomer
    ? `This animal will be added to ${customerLabel}'s livestock registry.`
    : "Clear photos are required for matching.";

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-3xl mx-auto p-4 sm:p-6">
        <form
          onSubmit={(e) => void onSubmit(e)}
          className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden"
        >
          <div className="px-5 py-4 sm:px-6 sm:py-5 bg-emerald-50/90 border-b border-emerald-100/90">
            <h1 className="text-2xl font-bold text-gray-900">
              {forCustomer ? "Register animal for customer" : "Register animal"}
            </h1>
            <p className="text-sm text-gray-600 mt-1">{headerSubtitle}</p>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
        {forCustomer ? (
          <div className="rounded-2xl border border-sky-100 bg-sky-50/80 px-4 py-3 text-sm text-sky-900">
            Registering for:{" "}
            <span className="font-semibold">{customerLabel}</span>
          </div>
        ) : null}

        {needsPack && !forCustomer ? (
          <BillingCostBanner
            taskCodes={[PACK_TASK]}
            title="Registration pack required"
            subtitle={`Your first ${FREE_LIFETIME} animals are free. The next registrations use a pack of 10 — you need at least ${packCost} credits. Recharge your account if your balance is too low.`}
          />
        ) : null}

        {packInUse && !needsPack && !forCustomer ? (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 px-4 py-3 text-sm text-gray-700">
            Pack slots left:{" "}
            <span className="font-semibold tabular-nums">
              {packInfo?.pack?.pack_slots_remaining ?? 0}
            </span>
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-600">Type</label>
            <select
              className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
              value={type_code}
              onChange={(e) => setTypeCode(e.target.value)}
            >
              {(vocab.types || []).map((t) => (
                <option key={t.code} value={t.code}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600">Gender</label>
            <select
              className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
              value={gender}
              onChange={(e) => setGender(e.target.value)}
            >
              <option value="unknown">Unknown</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600">Breed</label>
            <input
              className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
              value={breed}
              onChange={(e) => setBreed(e.target.value)}
              placeholder="e.g. Brahman"
            />
          </div>
          <div>
            <label className="text-xs text-gray-600">Colour</label>
            <input
              className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
              list="livestock-colours"
              value={colour}
              onChange={(e) => setColour(e.target.value)}
              placeholder="e.g. Tshumu"
            />
            <datalist id="livestock-colours">
              {(vocab.colours || []).map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-gray-600">Name (optional)</label>
            <input
              className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>

        <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3 space-y-2">
          <div className="text-sm font-medium text-amber-950">Dwelling / kraal location</div>
          <p className="text-xs text-amber-900/80">
            Required for distance estimates when a sighting is reported.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              className="border rounded-xl px-3 py-2 text-sm bg-white"
              placeholder="Village (optional)"
              value={dwelling_village}
              onChange={(e) => setDwellingVillage(e.target.value)}
            />
            <RippleButton
              type="button"
              className="px-3 py-2 rounded-xl border bg-white text-sm"
              onClick={captureDwelling}
            >
              Use my current location
            </RippleButton>
          </div>
          <div className="text-xs text-gray-600 tabular-nums">
            {dwelling_lat && dwelling_lng
              ? `Coords: ${Number(dwelling_lat).toFixed(5)}, ${Number(dwelling_lng).toFixed(5)}`
              : "No coordinates yet"}
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-600">Photos (required)</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="mt-1 block w-full text-sm"
            onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 5))}
          />
          <div className="text-xs text-gray-500 mt-1">{files.length} selected (max 5)</div>
        </div>

        {brandBearing ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-gray-800">Brands (up to 4)</div>
              <button
                type="button"
                className="text-sm text-iregistrygreen"
                onClick={() =>
                  setBrands((b) =>
                    b.length >= 4
                      ? b
                      : [...b, { characters: "", layout: "horizontal", side: "left", body_part: "shoulder" }],
                  )
                }
              >
                + Add brand
              </button>
            </div>
            <input
              className="w-full border rounded-xl px-3 py-2 text-sm"
              placeholder="Zone brand (optional)"
              value={zone_brand}
              onChange={(e) => setZoneBrand(e.target.value)}
            />
            {brands.map((b, i) => (
              <div key={i} className="grid grid-cols-2 gap-2 rounded-xl border p-3">
                <BrandOrientationField
                  layout={b.layout || "horizontal"}
                  characters={b.characters || ""}
                  onLayoutChange={(layout) =>
                    setBrands((rows) =>
                      rows.map((r, idx) => (idx === i ? { ...r, layout } : r)),
                    )
                  }
                  onCharactersChange={(characters) =>
                    setBrands((rows) =>
                      rows.map((r, idx) => (idx === i ? { ...r, characters } : r)),
                    )
                  }
                />
                <select
                  className="border rounded-lg px-2 py-1.5 text-sm"
                  value={b.side}
                  onChange={(e) =>
                    setBrands((rows) => rows.map((r, idx) => (idx === i ? { ...r, side: e.target.value } : r)))
                  }
                >
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </select>
                <select
                  className="border rounded-lg px-2 py-1.5 text-sm"
                  value={b.body_part}
                  onChange={(e) =>
                    setBrands((rows) =>
                      rows.map((r, idx) => (idx === i ? { ...r, body_part: e.target.value } : r)),
                    )
                  }
                >
                  <option value="shoulder">Shoulder</option>
                  <option value="thigh">Thigh</option>
                  <option value="flank">Flank</option>
                  <option value="neck">Neck</option>
                </select>
                <button
                  type="button"
                  className="col-span-2 text-left text-xs text-red-600 hover:underline"
                  onClick={() => setBrands((rows) => rows.filter((_, idx) => idx !== i))}
                >
                  Remove brand
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="space-y-2">
          <div className="text-sm font-medium text-gray-800">Ear tags (up to 2)</div>
          {earTags.map((t, i) => (
            <div key={i} className="flex gap-2">
              <input
                className="flex-1 border rounded-xl px-3 py-2 text-sm"
                placeholder="Tag ID"
                value={t.tag_id}
                onChange={(e) =>
                  setEarTags((rows) =>
                    rows.map((r, idx) => (idx === i ? { ...r, tag_id: e.target.value } : r)),
                  )
                }
              />
              <select
                className="border rounded-xl px-3 py-2 text-sm"
                value={t.side}
                onChange={(e) =>
                  setEarTags((rows) =>
                    rows.map((r, idx) => (idx === i ? { ...r, side: e.target.value } : r)),
                  )
                }
              >
                <option value="left">Left</option>
                <option value="right">Right</option>
              </select>
            </div>
          ))}
          {earTags.length < 2 ? (
            <button
              type="button"
              className="text-sm text-iregistrygreen"
              onClick={() => setEarTags((t) => [...t, { tag_id: "", side: "right" }])}
            >
              + Add ear tag
            </button>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <div className="text-sm font-medium text-gray-800">Ear marks</div>
            <button
              type="button"
              className="text-sm text-iregistrygreen"
              onClick={() => setEarMarks((m) => [...m, { mark_label: "", side: "left" }])}
            >
              + Add
            </button>
          </div>
          {earMarks.map((m, i) => (
            <div key={i} className="flex gap-2">
              <input
                className="flex-1 border rounded-xl px-3 py-2 text-sm"
                list="livestock-ear-marks"
                placeholder="e.g. Lesifi"
                value={m.mark_label}
                onChange={(e) =>
                  setEarMarks((rows) =>
                    rows.map((r, idx) => (idx === i ? { ...r, mark_label: e.target.value } : r)),
                  )
                }
              />
              <select
                className="border rounded-xl px-3 py-2 text-sm"
                value={m.side || ""}
                onChange={(e) =>
                  setEarMarks((rows) =>
                    rows.map((r, idx) => (idx === i ? { ...r, side: e.target.value || null } : r)),
                  )
                }
              >
                <option value="">Side</option>
                <option value="left">Left</option>
                <option value="right">Right</option>
              </select>
            </div>
          ))}
          <datalist id="livestock-ear-marks">
            {(vocab.ear_mark_types || []).map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <RippleButton
            type="button"
            className="px-4 py-2 rounded-xl bg-gray-100 text-sm"
            onClick={() => navigate(listBack)}
          >
            Cancel
          </RippleButton>
          <RippleButton
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-iregistrygreen text-white text-sm font-semibold shadow-sm disabled:opacity-60"
            disabled={saving}
          >
            {saving ? "Saving…" : "Register animal"}
          </RippleButton>
        </div>
          </div>
        </form>
      </div>
    </div>
  );
}
