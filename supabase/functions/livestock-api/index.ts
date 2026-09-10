import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders } from "../shared/cors.ts";
import { respond } from "../shared/respond.ts";
import { validateSession } from "../shared/validateSession.ts";
import { generateEmbedding } from "../shared/generateEmbedding.ts";
import { isPrivilegedRole } from "../shared/roles.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const REPLICATE_API_TOKEN = Deno.env.get("REPLICATE_API_TOKEN") || "";
const SIMILARITY_THRESHOLD = 0.90;
const MAX_SHORTLIST = 8;

type Session = { user_id: string; role: string };

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function asFiniteNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function publicAnimalCard(row: Record<string, unknown>, photos: unknown) {
  return {
    id: row.id,
    type_code: row.type_code,
    breed: row.breed ?? null,
    colour: row.colour ?? null,
    gender: row.gender ?? null,
    // Name withheld on public shortlist (photos are primary)
    photos: Array.isArray(photos) ? photos.slice(0, 3) : [],
  };
}

function identityPhrase(animal: {
  name?: string | null;
  breed?: string | null;
  colour?: string | null;
  brands?: { characters?: string }[];
  ear_tags?: { tag_id?: string }[];
}): string {
  const name = String(animal.name || "").trim();
  if (name) return name;
  const parts: string[] = [];
  if (animal.breed) parts.push(String(animal.breed));
  if (animal.colour) parts.push(String(animal.colour));
  const brand = animal.brands?.[0]?.characters;
  if (brand) parts.push(`brand ${brand}`);
  const tag = animal.ear_tags?.[0]?.tag_id;
  if (tag) parts.push(`tag ${tag}`);
  return parts.length ? parts.join(", ") : "your animal";
}

async function loadAnimalBundle(animalId: string, { includeDeleted = false } = {}) {
  let q = supabase.from("livestock_animals").select("*").eq("id", animalId);
  if (!includeDeleted) q = q.is("deleted_at", null);
  const { data: animal, error } = await q.maybeSingle();
  if (error || !animal) return null;

  const [{ data: brands }, { data: ear_tags }, { data: ear_marks }] = await Promise.all([
    supabase.from("livestock_brands").select("*").eq("animal_id", animalId).order("sort_order"),
    supabase.from("livestock_ear_tags").select("*").eq("animal_id", animalId),
    supabase.from("livestock_ear_marks").select("*").eq("animal_id", animalId),
  ]);

  return {
    ...animal,
    brands: brands || [],
    ear_tags: ear_tags || [],
    ear_marks: ear_marks || [],
  };
}

function canAccessAnimal(session: Session, ownerId: string) {
  return session.user_id === ownerId || isPrivilegedRole(session.role);
}

function normalizeStoragePhotoPath(raw: unknown): string | null {
  let p = typeof raw === "string" ? raw.trim() : "";
  if (!p) return null;
  const marker = "item-photos/";
  const idx = p.lastIndexOf(marker);
  if (idx !== -1) p = p.slice(idx + marker.length);
  p = p.replace(/^\/+/, "").replace(/^item-photos\//i, "");
  return p || null;
}

function photoPathsFromAnimalPhotos(photos: unknown, { firstOnly = false } = {}): string[] {
  if (!Array.isArray(photos)) return [];
  const out: string[] = [];
  for (const entry of photos) {
    let raw = "";
    if (typeof entry === "string") raw = entry;
    else if (entry && typeof entry === "object") {
      const o = entry as Record<string, unknown>;
      raw = String(o.original || o.thumb || o.path || o.url || "");
    }
    const path = normalizeStoragePhotoPath(raw);
    if (path) out.push(path);
    if (firstOnly && out.length) break;
  }
  return out;
}

async function signPhotoPaths(paths: string[], expiresSeconds = 60 * 60): Promise<(string | null)[]> {
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return paths.map(() => null);
  const { data, error } = await supabase.storage
    .from("item-photos")
    .createSignedUrls(unique, expiresSeconds);
  if (error || !data) return paths.map(() => null);
  const byPath = new Map<string, string | null>();
  for (const row of data) {
    const key = normalizeStoragePhotoPath(row.path) || String(row.path || "");
    byPath.set(key, row.signedUrl || null);
  }
  return paths.map((p) => byPath.get(p) || null);
}

async function resolveOwnerId(
  session: Session,
  requestedOwner: string,
  corsHeaders: Record<string, string>,
): Promise<{ ownerId: string } | { res: Response }> {
  if (!requestedOwner || requestedOwner === session.user_id) {
    return { ownerId: session.user_id };
  }
  if (!isPrivilegedRole(session.role)) {
    return { res: respond({ success: false, message: "Forbidden" }, corsHeaders, 403) };
  }
  return { ownerId: requestedOwner };
}

async function requireUser(req: Request) {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  const session = await validateSession(supabase, auth);
  if (!session) {
    return {
      session: null as Session | null,
      res: respond({ success: false, message: "Unauthorized" }, getCorsHeaders(req), 401),
    };
  }
  return { session: session as Session, res: null as Response | null };
}

async function runGetVocab(req: Request) {
  const corsHeaders = getCorsHeaders(req);
  const [{ data: types }, { data: colours }, { data: earMarks }, { data: breedRows }] = await Promise.all([
    supabase.from("livestock_types").select("code, label, brand_bearing").eq("active", true).order("label"),
    supabase.from("livestock_colours").select("label").eq("active", true).order("label"),
    supabase.from("livestock_ear_mark_types").select("label").eq("active", true).order("label"),
    supabase
      .from("livestock_animals")
      .select("breed")
      .not("breed", "is", null)
      .neq("breed", "")
      .is("deleted_at", null),
  ]);
  const breedSet = new Set<string>();
  for (const row of breedRows || []) {
    const b = String((row as { breed?: string | null }).breed || "").trim();
    if (b) breedSet.add(b);
  }
  const breeds = Array.from(breedSet).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  return respond(
    {
      success: true,
      types: types || [],
      colours: (colours || []).map((c: { label: string }) => c.label),
      ear_mark_types: (earMarks || []).map((c: { label: string }) => c.label),
      breeds,
    },
    corsHeaders,
    200,
  );
}

async function runGetPackStatus(req: Request, session: Session, body: Record<string, unknown> = {}) {
  const corsHeaders = getCorsHeaders(req);
  const ownerResolved = await resolveOwnerId(session, asString(body.owner_id), corsHeaders);
  if ("res" in ownerResolved) return ownerResolved.res;
  const ownerId = ownerResolved.ownerId;

  await supabase.from("livestock_owner_packs").upsert({ user_id: ownerId }, { onConflict: "user_id" });
  const { data: pack } = await supabase
    .from("livestock_owner_packs")
    .select("lifetime_registered, pack_slots_remaining")
    .eq("user_id", ownerId)
    .maybeSingle();

  const { data: can } = await supabase.rpc("livestock_can_register", { p_user_id: ownerId });
  const row = Array.isArray(can) ? can[0] : can;

  return respond(
    {
      success: true,
      pack: {
        lifetime_registered: pack?.lifetime_registered ?? 0,
        pack_slots_remaining: pack?.pack_slots_remaining ?? 0,
      },
      can_register: Boolean(row?.allowed),
      needs_pack: Boolean(row?.needs_pack),
      reason: row?.reason ?? null,
    },
    corsHeaders,
    200,
  );
}

async function runBuyPack(req: Request, session: Session) {
  const corsHeaders = getCorsHeaders(req);
  const { data, error } = await supabase.rpc("livestock_grant_registration_pack", {
    p_user_id: session.user_id,
  });
  if (error) {
    return respond({ success: false, message: error.message || "Failed to purchase pack" }, corsHeaders, 500);
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.success) {
    return respond(
      {
        success: false,
        message:
          "Insufficient credits for a livestock registration pack. Please recharge your account and try again.",
        billing: { required: true, task_code: "LIVESTOCK_REGISTER_PACK" },
      },
      corsHeaders,
      402,
    );
  }
  return respond(
    { success: true, pack_slots_remaining: row.pack_slots_remaining },
    corsHeaders,
    200,
  );
}

async function runListMine(req: Request, session: Session, body: Record<string, unknown> = {}) {
  const corsHeaders = getCorsHeaders(req);
  const view = asString(body.view).toLowerCase() || "active";
  const query = asString(body.query).toLowerCase();
  const page = Math.max(1, Math.floor(asFiniteNumber(body.page) || 1));
  const pageSize = Math.min(50, Math.max(1, Math.floor(asFiniteNumber(body.pageSize) || 12)));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const requestedOwner = asString(body.owner_id);
  const viewAll =
    isPrivilegedRole(session.role) &&
    (!requestedOwner || requestedOwner === "__all__");

  let ownerId: string | null = session.user_id;
  if (viewAll) {
    ownerId = null;
  } else if (requestedOwner && requestedOwner !== session.user_id) {
    if (!isPrivilegedRole(session.role)) {
      return respond({ success: false, message: "Forbidden" }, corsHeaders, 403);
    }
    ownerId = requestedOwner;
  }

  let q = supabase
    .from("livestock_animals")
    .select(
      "id, owner_id, type_code, gender, breed, colour, name, status, photos, dwelling_village, created_at, updated_at, deleted_at",
      { count: "exact" },
    );

  if (ownerId) q = q.eq("owner_id", ownerId);

  if (view === "deleted") {
    q = q.or("status.eq.deleted,deleted_at.not.is.null");
  } else if (view === "missing") {
    q = q.is("deleted_at", null).eq("status", "missing");
  } else if (view === "recovered") {
    q = q.is("deleted_at", null).eq("status", "recovered");
  } else {
    q = q.is("deleted_at", null).eq("status", "active");
  }

  if (query) {
    const esc = query.replace(/%/g, "").replace(/,/g, " ");
    q = q.or(
      `name.ilike.%${esc}%,breed.ilike.%${esc}%,colour.ilike.%${esc}%,type_code.ilike.%${esc}%,dwelling_village.ilike.%${esc}%`,
    );
  }

  q = q.order("created_at", { ascending: false }).range(from, to);

  const { data, error, count } = await q;
  if (error) {
    return respond({ success: false, message: error.message || "Failed to list animals" }, corsHeaders, 500);
  }

  const animals = data || [];
  const thumbPaths = animals.map(
    (a: { photos?: unknown }) => photoPathsFromAnimalPhotos(a.photos, { firstOnly: true })[0] || "",
  );
  const signedThumbs = await signPhotoPaths(thumbPaths);
  const withThumbs = animals.map((a: Record<string, unknown>, i: number) => ({
    ...a,
    signed_thumb: signedThumbs[i] || null,
  }));

  return respond(
    {
      success: true,
      animals: withThumbs,
      page,
      pageSize,
      total: typeof count === "number" ? count : animals.length,
    },
    corsHeaders,
    200,
  );
}

async function runGetMine(req: Request, session: Session, body: Record<string, unknown>) {
  const corsHeaders = getCorsHeaders(req);
  const id = asString(body.id);
  if (!id) return respond({ success: false, message: "id is required" }, corsHeaders, 400);

  const animal = await loadAnimalBundle(id, { includeDeleted: true });
  if (!animal || !canAccessAnimal(session, String(animal.owner_id))) {
    return respond({ success: false, message: "Animal not found" }, corsHeaders, 404);
  }

  const paths = photoPathsFromAnimalPhotos(animal.photos);
  const signed = await signPhotoPaths(paths);
  const signed_photos = paths
    .map((path, i) => (signed[i] ? { path, url: signed[i] as string } : null))
    .filter(Boolean);

  let owner: Record<string, unknown> | null = null;
  if (String(animal.owner_id) !== String(session.user_id)) {
    const { data: ownerRow } = await supabase
      .from("users")
      .select("id, slug, first_name, last_name, email, phone, id_number, village, ward")
      .eq("id", animal.owner_id)
      .maybeSingle();
    owner = ownerRow || null;
  }

  const { data: typeRow } = await supabase
    .from("livestock_types")
    .select("code, label, brand_bearing")
    .eq("code", animal.type_code)
    .maybeSingle();

  return respond(
    {
      success: true,
      animal: {
        ...animal,
        signed_photos,
        brand_bearing: Boolean(typeRow?.brand_bearing),
        type_label: typeRow?.label || animal.type_code,
      },
      owner,
    },
    corsHeaders,
    200,
  );
}

async function runRegister(req: Request, session: Session, body: Record<string, unknown>) {
  const corsHeaders = getCorsHeaders(req);

  const type_code = asString(body.type_code).toLowerCase();
  const gender = asString(body.gender).toLowerCase() || null;
  const breed = asString(body.breed) || null;
  const colour = asString(body.colour) || null;
  const name = asString(body.name) || null;
  const zone_brand = asString(body.zone_brand) || null;
  const dwelling_lat = asFiniteNumber(body.dwelling_lat);
  const dwelling_lng = asFiniteNumber(body.dwelling_lng);
  const dwelling_village = asString(body.dwelling_village) || null;
  const dwelling_ward = asString(body.dwelling_ward) || null;
  const dwelling_station = asString(body.dwelling_station) || null;
  const photos = Array.isArray(body.photos) ? body.photos : [];
  const brands = Array.isArray(body.brands) ? body.brands : [];
  const ear_tags = Array.isArray(body.ear_tags) ? body.ear_tags : [];
  const ear_marks = Array.isArray(body.ear_marks) ? body.ear_marks : [];

  const ownerResolved = await resolveOwnerId(session, asString(body.owner_id), corsHeaders);
  if ("res" in ownerResolved) return ownerResolved.res;
  const ownerId = ownerResolved.ownerId;

  if (!type_code) {
    return respond({ success: false, message: "type_code is required" }, corsHeaders, 400);
  }
  if (photos.length < 1) {
    return respond({ success: false, message: "At least one photo is required" }, corsHeaders, 400);
  }
  if (brands.length > 4) {
    return respond({ success: false, message: "Maximum 4 brands" }, corsHeaders, 400);
  }
  if (ear_tags.length > 2) {
    return respond({ success: false, message: "Maximum 2 ear tags" }, corsHeaders, 400);
  }

  const { data: typeRow } = await supabase
    .from("livestock_types")
    .select("code, brand_bearing")
    .eq("code", type_code)
    .eq("active", true)
    .maybeSingle();

  if (!typeRow) {
    return respond({ success: false, message: "Unknown animal type" }, corsHeaders, 400);
  }
  if (!typeRow.brand_bearing && brands.length > 0) {
    return respond({ success: false, message: "This animal type does not use brands" }, corsHeaders, 400);
  }

  const { data: canRows } = await supabase.rpc("livestock_can_register", { p_user_id: ownerId });
  const can = Array.isArray(canRows) ? canRows[0] : canRows;
  if (!can?.allowed) {
    return respond(
      {
        success: false,
        code: "NEED_PACK",
        message:
          "Your first 2 animal registrations are free. To register more, buy a registration pack (10 animals). Please ensure you have enough credits, or recharge your account.",
        billing: { required: true, task_code: "LIVESTOCK_REGISTER_PACK" },
      },
      corsHeaders,
      402,
    );
  }

  const { data: consumed, error: consumeErr } = await supabase.rpc("livestock_consume_registration_slot", {
    p_user_id: ownerId,
  });
  if (consumeErr) {
    return respond({ success: false, message: consumeErr.message || "Billing failed" }, corsHeaders, 500);
  }
  const slot = Array.isArray(consumed) ? consumed[0] : consumed;
  if (!slot?.success) {
    return respond(
      {
        success: false,
        code: "NEED_PACK",
        message:
          "Your first 2 animal registrations are free. To register more, buy a registration pack (10 animals). Please ensure you have enough credits, or recharge your account.",
        billing: { required: true, task_code: "LIVESTOCK_REGISTER_PACK" },
      },
      corsHeaders,
      402,
    );
  }

  const { data: animal, error: insErr } = await supabase
    .from("livestock_animals")
    .insert({
      owner_id: ownerId,
      type_code,
      gender: gender && ["male", "female", "unknown"].includes(gender) ? gender : "unknown",
      breed,
      colour,
      name,
      zone_brand,
      dwelling_lat,
      dwelling_lng,
      dwelling_village,
      dwelling_ward,
      dwelling_station,
      photos,
      status: "active",
    })
    .select("*")
    .single();

  if (insErr || !animal) {
    return respond({ success: false, message: insErr?.message || "Failed to register animal" }, corsHeaders, 500);
  }

  if (typeRow.brand_bearing && brands.length) {
    const brandRows = brands.slice(0, 4).map((b: Record<string, unknown>, i: number) => {
      const characters = asString(b.characters).toUpperCase();
      const char_count = characters.length === 4 ? 4 : 3;
      const layout = asString(b.layout) || (char_count === 4 ? "square" : "horizontal");
      return {
        animal_id: animal.id,
        characters,
        char_count,
        layout,
        side: asString(b.side) === "right" ? "right" : "left",
        body_part: ["shoulder", "thigh", "flank", "neck"].includes(asString(b.body_part))
          ? asString(b.body_part)
          : "shoulder",
        sort_order: i,
      };
    }).filter((b: { characters: string }) => b.characters.length >= 3);
    if (brandRows.length) await supabase.from("livestock_brands").insert(brandRows);
  }

  if (ear_tags.length) {
    const tagRows = ear_tags.slice(0, 2).map((t: Record<string, unknown>) => ({
      animal_id: animal.id,
      tag_id: asString(t.tag_id),
      side: asString(t.side) === "right" ? "right" : "left",
    })).filter((t: { tag_id: string }) => t.tag_id);
    if (tagRows.length) await supabase.from("livestock_ear_tags").insert(tagRows);
  }

  if (ear_marks.length) {
    const markRows = ear_marks.map((m: Record<string, unknown>) => ({
      animal_id: animal.id,
      mark_label: asString(m.mark_label) || asString(m.label),
      side: asString(m.side) === "right" ? "right" : asString(m.side) === "left" ? "left" : null,
    })).filter((m: { mark_label: string }) => m.mark_label);
    if (markRows.length) await supabase.from("livestock_ear_marks").insert(markRows);
  }

  const bundle = await loadAnimalBundle(animal.id);
  return respond(
    {
      success: true,
      animal: bundle,
      pack: {
        lifetime_registered: slot.lifetime_registered,
        pack_slots_remaining: slot.pack_slots_remaining,
      },
    },
    corsHeaders,
    200,
  );
}

async function runSearchText(req: Request, body: Record<string, unknown>) {
  const corsHeaders = getCorsHeaders(req);
  const q = asString(body.query) || asString(body.q);
  const mode = asString(body.mode) || "any"; // ear_tag | brand | any
  if (q.length < 2) {
    return respond({ success: false, message: "Enter at least 2 characters" }, corsHeaders, 400);
  }

  const sessionId = crypto.randomUUID();
  const animalIds = new Set<string>();

  if (mode === "ear_tag" || mode === "any") {
    const { data: tags } = await supabase
      .from("livestock_ear_tags")
      .select("animal_id")
      .ilike("tag_id", `%${q}%`)
      .limit(40);
    for (const t of tags || []) animalIds.add(String(t.animal_id));
  }

  if (mode === "brand" || mode === "any") {
    const { data: brands } = await supabase
      .from("livestock_brands")
      .select("animal_id")
      .ilike("characters", `%${q}%`)
      .limit(40);
    for (const b of brands || []) animalIds.add(String(b.animal_id));
  }

  const ids = [...animalIds].slice(0, MAX_SHORTLIST);
  if (!ids.length) {
    return respond({ success: true, found: false, session_id: sessionId, matches: [] }, corsHeaders, 200);
  }

  const { data: animals } = await supabase
    .from("livestock_animals")
    .select("id, type_code, breed, colour, gender, photos, status")
    .in("id", ids)
    .is("deleted_at", null)
    .neq("status", "deleted");

  const matches = (animals || []).map((a: Record<string, unknown>) => publicAnimalCard(a, a.photos));

  if (matches.length) {
    await supabase.from("livestock_sighting_candidates").insert(
      matches.map((m: { id: string }) => ({
        session_id: sessionId,
        animal_id: m.id,
        similarity: null,
      })),
    );
  }

  return respond(
    { success: true, found: matches.length > 0, session_id: sessionId, matches },
    corsHeaders,
    200,
  );
}

async function runSearchPhoto(req: Request, body: Record<string, unknown>) {
  const corsHeaders = getCorsHeaders(req);
  const imageUrl = asString(body.imageUrl) || asString(body.image_url);
  if (!imageUrl) {
    return respond({ success: false, message: "imageUrl is required" }, corsHeaders, 400);
  }
  if (!REPLICATE_API_TOKEN) {
    return respond({ success: false, message: "Photo search is not configured" }, corsHeaders, 503);
  }

  // Basic client-reported quality gate (full blur detection can be added client-side)
  const width = asFiniteNumber(body.width);
  const height = asFiniteNumber(body.height);
  if (width != null && height != null && (width < 480 || height < 480)) {
    return respond(
      {
        success: false,
        code: "LOW_RESOLUTION",
        message: "Photo is too low resolution. Use a clearer, higher-resolution photo.",
      },
      corsHeaders,
      400,
    );
  }

  const sessionId = crypto.randomUUID();
  const embedding = await generateEmbedding(imageUrl, REPLICATE_API_TOKEN);

  const { data: similar, error } = await supabase.rpc("find_similar_livestock_images", {
    query_embedding: embedding,
    similarity_threshold: SIMILARITY_THRESHOLD,
    match_count: MAX_SHORTLIST,
  });

  if (error) {
    // Fallback: no embeddings yet — empty shortlist rather than hard fail
    console.error("find_similar_livestock_images:", error.message);
    return respond({ success: true, found: false, session_id: sessionId, matches: [] }, corsHeaders, 200);
  }

  const bestByAnimal = new Map<string, number>();
  for (const row of similar || []) {
    const id = String(row.animal_id);
    const sim = Number(row.similarity) || 0;
    const prev = bestByAnimal.get(id) ?? 0;
    if (sim > prev) bestByAnimal.set(id, sim);
  }

  const ids = [...bestByAnimal.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_SHORTLIST)
    .map(([id]) => id);

  if (!ids.length) {
    return respond({ success: true, found: false, session_id: sessionId, matches: [] }, corsHeaders, 200);
  }

  const { data: animals } = await supabase
    .from("livestock_animals")
    .select("id, type_code, breed, colour, gender, photos, status")
    .in("id", ids)
    .is("deleted_at", null);

  const matches = (animals || []).map((a: Record<string, unknown>) => ({
    ...publicAnimalCard(a, a.photos),
    similarity: bestByAnimal.get(String(a.id)) ?? null,
  }));

  await supabase.from("livestock_sighting_candidates").insert(
    matches.map((m: { id: string; similarity: number | null }) => ({
      session_id: sessionId,
      animal_id: m.id,
      similarity: m.similarity,
    })),
  );

  return respond(
    { success: true, found: matches.length > 0, session_id: sessionId, matches },
    corsHeaders,
    200,
  );
}

async function runPickSighting(req: Request, body: Record<string, unknown>) {
  const corsHeaders = getCorsHeaders(req);
  const animalId = asString(body.animal_id);
  const sessionId = asString(body.session_id) || crypto.randomUUID();
  const source = asString(body.source) || "photo";
  const query_text = asString(body.query_text) || null;
  const lat = asFiniteNumber(body.lat);
  const lng = asFiniteNumber(body.lng);
  const accuracy_m = asFiniteNumber(body.accuracy_m);
  const sighting_photos = Array.isArray(body.sighting_photos) ? body.sighting_photos : [];

  if (!animalId) {
    return respond({ success: false, message: "animal_id is required" }, corsHeaders, 400);
  }
  if (!["photo", "ear_tag", "brand"].includes(source)) {
    return respond({ success: false, message: "Invalid source" }, corsHeaders, 400);
  }

  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  const session = await validateSession(supabase, auth);

  const animal = await loadAnimalBundle(animalId);
  if (!animal) {
    return respond({ success: false, message: "Animal not found" }, corsHeaders, 404);
  }

  let distance_km: number | null = null;
  let distance_band: string | null = null;
  if (lat != null && lng != null && animal.dwelling_lat != null && animal.dwelling_lng != null) {
    const { data: dist } = await supabase.rpc("livestock_distance_km", {
      lat1: animal.dwelling_lat,
      lng1: animal.dwelling_lng,
      lat2: lat,
      lng2: lng,
    });
    distance_km = typeof dist === "number" ? dist : asFiniteNumber(dist);
    const { data: band } = await supabase.rpc("livestock_distance_band", { p_km: distance_km });
    distance_band = typeof band === "string" ? band : null;
  }

  const { data: sighting, error } = await supabase
    .from("livestock_sightings")
    .insert({
      animal_id: animalId,
      reporter_user_id: session?.user_id ?? null,
      source,
      query_text,
      sighting_photos,
      lat,
      lng,
      accuracy_m,
      distance_km,
      distance_band,
      stranger_confidence_boost: true,
      owner_decision: "pending",
      status: "open",
    })
    .select("*")
    .single();

  if (error || !sighting) {
    return respond({ success: false, message: error?.message || "Failed to create sighting" }, corsHeaders, 500);
  }

  await supabase
    .from("livestock_sighting_candidates")
    .update({ sighting_id: sighting.id })
    .eq("session_id", sessionId)
    .eq("animal_id", animalId);

  const who = identityPhrase(animal);
  const placeBit = distance_band
    ? ` was located some ${distance_band} away.`
    : " may have been sighted (location not shared by the reporter).";
  const message = `Your animal ${who}${placeBit} Open Livestock → Sightings to accept or reject.`;

  // Best-effort owner ping (itemid nullable — see livestock notification migration)
  const { data: notif, error: notifErr } = await supabase
    .from("item_notifications")
    .insert({
      itemid: null,
      ownerid: animal.owner_id,
      recipient_type: "owner",
      message,
      contact: "Livestock sighting",
    })
    .select("id")
    .maybeSingle();

  if (notifErr) {
    console.error("livestock sighting notification insert:", notifErr.message);
  } else if (notif?.id) {
    await supabase
      .from("livestock_sightings")
      .update({ notification_id: notif.id })
      .eq("id", sighting.id);
  }

  return respond(
    {
      success: true,
      sighting: {
        id: sighting.id,
        animal_id: animalId,
        distance_band,
        has_location: lat != null && lng != null,
      },
    },
    corsHeaders,
    200,
  );
}

async function runListSightings(req: Request, session: Session) {
  const corsHeaders = getCorsHeaders(req);
  const { data: animals } = await supabase
    .from("livestock_animals")
    .select("id")
    .eq("owner_id", session.user_id)
    .is("deleted_at", null);

  const ids = (animals || []).map((a: { id: string }) => a.id);
  if (!ids.length) {
    return respond({ success: true, sightings: [] }, corsHeaders, 200);
  }

  const { data, error } = await supabase
    .from("livestock_sightings")
    .select(
      "id, animal_id, source, distance_km, distance_band, owner_decision, location_revealed_at, created_at, status, sighting_photos, lat, lng, accuracy_m",
    )
    .in("animal_id", ids)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return respond({ success: false, message: error.message }, corsHeaders, 500);
  }

  const enriched = [];
  for (const s of data || []) {
    const animal = await loadAnimalBundle(s.animal_id);
    const has_coords = s.lat != null && s.lng != null;
    const revealed = Boolean(s.location_revealed_at);
    enriched.push({
      id: s.id,
      animal_id: s.animal_id,
      source: s.source,
      distance_km: s.distance_km,
      distance_band: s.distance_band,
      owner_decision: s.owner_decision,
      location_revealed_at: s.location_revealed_at,
      created_at: s.created_at,
      status: s.status,
      sighting_photos: s.sighting_photos,
      has_coords,
      animal: animal
        ? {
          id: animal.id,
          name: animal.name,
          type_code: animal.type_code,
          breed: animal.breed,
          colour: animal.colour,
          photos: animal.photos,
        }
        : null,
      // Exact coords only after paid reveal
      location: revealed && has_coords
        ? { lat: s.lat, lng: s.lng, accuracy_m: s.accuracy_m }
        : null,
    });
  }

  return respond({ success: true, sightings: enriched }, corsHeaders, 200);
}

async function runDecideSighting(req: Request, session: Session, body: Record<string, unknown>) {
  const corsHeaders = getCorsHeaders(req);
  const id = asString(body.id) || asString(body.sighting_id);
  const decision = asString(body.decision); // accepted | rejected
  if (!id || !["accepted", "rejected"].includes(decision)) {
    return respond({ success: false, message: "id and decision (accepted|rejected) are required" }, corsHeaders, 400);
  }

  const { data: owned } = await supabase
    .from("livestock_sightings")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!owned) {
    return respond({ success: false, message: "Sighting not found" }, corsHeaders, 404);
  }

  const { data: animal } = await supabase
    .from("livestock_animals")
    .select("id, owner_id")
    .eq("id", owned.animal_id)
    .maybeSingle();

  if (!animal || animal.owner_id !== session.user_id) {
    return respond({ success: false, message: "Forbidden" }, corsHeaders, 403);
  }

  if (owned.owner_decision !== "pending") {
    return respond({ success: false, message: "Sighting already decided" }, corsHeaders, 409);
  }

  const { data: updated, error } = await supabase
    .from("livestock_sightings")
    .update({
      owner_decision: decision,
      owner_decided_at: new Date().toISOString(),
      status: decision === "rejected" ? "closed" : "open",
    })
    .eq("id", id)
    .select("id, owner_decision, distance_band, animal_id")
    .single();

  if (error) {
    return respond({ success: false, message: error.message }, corsHeaders, 500);
  }

  return respond({ success: true, sighting: updated }, corsHeaders, 200);
}

async function runRevealSighting(req: Request, session: Session, body: Record<string, unknown>) {
  const corsHeaders = getCorsHeaders(req);
  const id = asString(body.id) || asString(body.sighting_id);
  if (!id) return respond({ success: false, message: "id is required" }, corsHeaders, 400);

  const { data: sighting } = await supabase
    .from("livestock_sightings")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!sighting) {
    return respond({ success: false, message: "Sighting not found" }, corsHeaders, 404);
  }

  const { data: animal } = await supabase
    .from("livestock_animals")
    .select("id, owner_id")
    .eq("id", sighting.animal_id)
    .maybeSingle();

  if (!animal || animal.owner_id !== session.user_id) {
    return respond({ success: false, message: "Forbidden" }, corsHeaders, 403);
  }

  if (sighting.owner_decision !== "accepted") {
    return respond({ success: false, message: "Accept the sighting before revealing location." }, corsHeaders, 409);
  }

  if (sighting.lat == null || sighting.lng == null) {
    return respond({ success: false, message: "No location was captured for this sighting." }, corsHeaders, 400);
  }

  if (sighting.location_revealed_at) {
    return respond(
      {
        success: true,
        already_revealed: true,
        location: { lat: sighting.lat, lng: sighting.lng, accuracy_m: sighting.accuracy_m },
      },
      corsHeaders,
      200,
    );
  }

  const { data: spend, error: spendErr } = await supabase.rpc("spend_credits", {
    p_user_id: session.user_id,
    p_task_code: "LIVESTOCK_REVEAL_LOCATION",
    p_reference: id,
    p_metadata: { kind: "livestock-reveal-location", sighting_id: id },
  });

  if (spendErr) {
    return respond({ success: false, message: spendErr.message || "Billing failed" }, corsHeaders, 500);
  }
  const spendRow = Array.isArray(spend) ? spend[0] : spend;
  if (!spendRow?.success) {
    return respond(
      {
        success: false,
        message: "Insufficient credits to reveal location (2 credits).",
        billing: { required: true, task_code: "LIVESTOCK_REVEAL_LOCATION" },
      },
      corsHeaders,
      402,
    );
  }

  const { error: upErr } = await supabase
    .from("livestock_sightings")
    .update({ location_revealed_at: new Date().toISOString() })
    .eq("id", id);

  if (upErr) {
    return respond({ success: false, message: upErr.message }, corsHeaders, 500);
  }

  return respond(
    {
      success: true,
      location: { lat: sighting.lat, lng: sighting.lng, accuracy_m: sighting.accuracy_m },
      new_balance: spendRow.new_balance,
    },
    corsHeaders,
    200,
  );
}

async function runSignPhotoUploads(req: Request, session: Session, body: Record<string, unknown>) {
  const corsHeaders = getCorsHeaders(req);
  const files = Array.isArray(body.files) ? body.files : [];
  if (!files.length || files.length > 5) {
    return respond({ success: false, message: "Provide 1–5 files" }, corsHeaders, 400);
  }

  const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
  const uploads = [];

  for (const f of files) {
    const contentType = asString((f as { contentType?: string }).contentType) || "image/jpeg";
    if (!ALLOWED.includes(contentType)) {
      return respond({ success: false, message: "Only jpeg, png, webp allowed" }, corsHeaders, 400);
    }
    const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
    const path = `livestock/${session.user_id}/${crypto.randomUUID()}.${ext}`;
    const { data, error } = await supabase.storage.from("item-photos").createSignedUploadUrl(path);
    if (error || !data) {
      return respond({ success: false, message: error?.message || "Failed to sign upload" }, corsHeaders, 500);
    }
    uploads.push({
      path,
      token: data.token,
      signedUrl: data.signedUrl,
      contentType,
    });
  }

  return respond({ success: true, uploads }, corsHeaders, 200);
}

async function runStoreEmbedding(req: Request, session: Session, body: Record<string, unknown>) {
  const corsHeaders = getCorsHeaders(req);
  const animalId = asString(body.animal_id);
  const imageUrl = asString(body.imageUrl) || asString(body.image_url);
  const photoPath = asString(body.photo_path);
  if (!animalId || !imageUrl || !photoPath) {
    return respond({ success: false, message: "animal_id, imageUrl, and photo_path are required" }, corsHeaders, 400);
  }
  if (!REPLICATE_API_TOKEN) {
    return respond({ success: false, message: "Embeddings not configured" }, corsHeaders, 503);
  }

  const { data: animal } = await supabase
    .from("livestock_animals")
    .select("id, owner_id")
    .eq("id", animalId)
    .maybeSingle();
  if (!animal || !canAccessAnimal(session, String(animal.owner_id))) {
    return respond({ success: false, message: "Forbidden" }, corsHeaders, 403);
  }

  const embedding = await generateEmbedding(imageUrl, REPLICATE_API_TOKEN);
  const { error } = await supabase.from("livestock_image_embeddings").upsert(
    { animal_id: animalId, photo_path: photoPath, embedding },
    { onConflict: "animal_id,photo_path" },
  );
  if (error) {
    return respond({ success: false, message: error.message }, corsHeaders, 500);
  }
  return respond({ success: true }, corsHeaders, 200);
}

async function runSetStatus(req: Request, session: Session, body: Record<string, unknown>) {
  const corsHeaders = getCorsHeaders(req);
  const id = asString(body.id) || asString(body.animal_id);
  const status = asString(body.status).toLowerCase();
  const allowed = ["active", "missing", "recovered", "deleted"];
  if (!id || !allowed.includes(status)) {
    return respond(
      {
        success: false,
        message: "id and status (active|missing|recovered|deleted) are required",
      },
      corsHeaders,
      400,
    );
  }

  const { data: animal } = await supabase
    .from("livestock_animals")
    .select("id, owner_id, status, deleted_at")
    .eq("id", id)
    .maybeSingle();

  if (!animal || !canAccessAnimal(session, String(animal.owner_id))) {
    return respond({ success: false, message: "Animal not found" }, corsHeaders, 404);
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status };
  if (status === "deleted") {
    patch.deleted_at = animal.deleted_at || now;
  } else {
    patch.deleted_at = null;
  }

  const { data: updated, error } = await supabase
    .from("livestock_animals")
    .update(patch)
    .eq("id", id)
    .select("id, status, deleted_at")
    .single();

  if (error) {
    return respond({ success: false, message: error.message }, corsHeaders, 500);
  }

  return respond({ success: true, animal: updated }, corsHeaders, 200);
}

async function runUpdateMine(req: Request, session: Session, body: Record<string, unknown>) {
  const corsHeaders = getCorsHeaders(req);
  const id = asString(body.id) || asString(body.animal_id);
  if (!id) return respond({ success: false, message: "id is required" }, corsHeaders, 400);

  const { data: existing } = await supabase
    .from("livestock_animals")
    .select("id, owner_id")
    .eq("id", id)
    .maybeSingle();
  if (!existing || !canAccessAnimal(session, String(existing.owner_id))) {
    return respond({ success: false, message: "Animal not found" }, corsHeaders, 404);
  }

  const patch: Record<string, unknown> = {};
  if ("name" in body) patch.name = asString(body.name) || null;
  if ("breed" in body) patch.breed = asString(body.breed) || null;
  if ("colour" in body) patch.colour = asString(body.colour) || null;
  if ("gender" in body) {
    const g = asString(body.gender).toLowerCase();
    patch.gender = ["male", "female", "unknown"].includes(g) ? g : "unknown";
  }
  if ("zone_brand" in body) patch.zone_brand = asString(body.zone_brand) || null;
  if ("dwelling_village" in body) patch.dwelling_village = asString(body.dwelling_village) || null;
  if ("dwelling_lat" in body) patch.dwelling_lat = asFiniteNumber(body.dwelling_lat);
  if ("dwelling_lng" in body) patch.dwelling_lng = asFiniteNumber(body.dwelling_lng);

  if (!Object.keys(patch).length) {
    return respond({ success: false, message: "No fields to update" }, corsHeaders, 400);
  }

  const { error } = await supabase.from("livestock_animals").update(patch).eq("id", id);
  if (error) return respond({ success: false, message: error.message }, corsHeaders, 500);

  const animal = await loadAnimalBundle(id, { includeDeleted: true });
  return respond({ success: true, animal }, corsHeaders, 200);
}

async function runAddBrand(req: Request, session: Session, body: Record<string, unknown>) {
  const corsHeaders = getCorsHeaders(req);
  const id = asString(body.id) || asString(body.animal_id);
  if (!id) return respond({ success: false, message: "id is required" }, corsHeaders, 400);

  const animal = await loadAnimalBundle(id, { includeDeleted: true });
  if (!animal || !canAccessAnimal(session, String(animal.owner_id))) {
    return respond({ success: false, message: "Animal not found" }, corsHeaders, 404);
  }

  const { data: typeRow } = await supabase
    .from("livestock_types")
    .select("brand_bearing")
    .eq("code", animal.type_code)
    .maybeSingle();
  if (!typeRow?.brand_bearing) {
    return respond({ success: false, message: "This animal type does not use brands" }, corsHeaders, 400);
  }

  const existingBrands = Array.isArray(animal.brands) ? animal.brands : [];
  if (existingBrands.length >= 4) {
    return respond({ success: false, message: "Maximum 4 brands" }, corsHeaders, 400);
  }

  const parsed = parseBrandPayload(body);
  if ("error" in parsed) {
    return respond({ success: false, message: parsed.error }, corsHeaders, 400);
  }

  const { error } = await supabase.from("livestock_brands").insert({
    animal_id: id,
    characters: parsed.characters,
    char_count: parsed.char_count,
    layout: parsed.layout,
    side: parsed.side,
    body_part: parsed.body_part,
    sort_order: existingBrands.length,
  });
  if (error) return respond({ success: false, message: error.message }, corsHeaders, 500);

  const bundle = await loadAnimalBundle(id, { includeDeleted: true });
  return respond({ success: true, animal: bundle }, corsHeaders, 200);
}

async function runAddEarTag(req: Request, session: Session, body: Record<string, unknown>) {
  const corsHeaders = getCorsHeaders(req);
  const id = asString(body.id) || asString(body.animal_id);
  if (!id) return respond({ success: false, message: "id is required" }, corsHeaders, 400);

  const animal = await loadAnimalBundle(id, { includeDeleted: true });
  if (!animal || !canAccessAnimal(session, String(animal.owner_id))) {
    return respond({ success: false, message: "Animal not found" }, corsHeaders, 404);
  }

  const existingTags = Array.isArray(animal.ear_tags) ? animal.ear_tags : [];
  if (existingTags.length >= 2) {
    return respond({ success: false, message: "Maximum 2 ear tags" }, corsHeaders, 400);
  }

  const tag_id = asString(body.tag_id);
  if (!tag_id) return respond({ success: false, message: "tag_id is required" }, corsHeaders, 400);
  const side = asString(body.side) === "right" ? "right" : "left";

  const { error } = await supabase.from("livestock_ear_tags").insert({
    animal_id: id,
    tag_id,
    side,
  });
  if (error) return respond({ success: false, message: error.message }, corsHeaders, 500);

  const bundle = await loadAnimalBundle(id, { includeDeleted: true });
  return respond({ success: true, animal: bundle }, corsHeaders, 200);
}

function parseBrandPayload(body: Record<string, unknown>) {
  const characters = asString(body.characters).toUpperCase().replace(/[^A-Z0-9]/g, "");
  const char_count = characters.length === 4 ? 4 : 3;
  if (characters.length < 3) return { error: "Brand needs at least 3 characters" as const };
  const layout = asString(body.layout) || (char_count === 4 ? "square" : "horizontal");
  const side = asString(body.side) === "right" ? "right" : "left";
  const body_part = ["shoulder", "thigh", "flank", "neck"].includes(asString(body.body_part))
    ? asString(body.body_part)
    : "shoulder";
  return { characters, char_count, layout, side, body_part };
}

async function runUpdateBrand(req: Request, session: Session, body: Record<string, unknown>) {
  const corsHeaders = getCorsHeaders(req);
  const brandId = asString(body.brand_id) || asString(body.id);
  if (!brandId) return respond({ success: false, message: "brand_id is required" }, corsHeaders, 400);

  const { data: brand } = await supabase
    .from("livestock_brands")
    .select("id, animal_id")
    .eq("id", brandId)
    .maybeSingle();
  if (!brand) return respond({ success: false, message: "Brand not found" }, corsHeaders, 404);

  const animal = await loadAnimalBundle(String(brand.animal_id), { includeDeleted: true });
  if (!animal || !canAccessAnimal(session, String(animal.owner_id))) {
    return respond({ success: false, message: "Animal not found" }, corsHeaders, 404);
  }

  const parsed = parseBrandPayload(body);
  if ("error" in parsed) {
    return respond({ success: false, message: parsed.error }, corsHeaders, 400);
  }

  const { error } = await supabase
    .from("livestock_brands")
    .update({
      characters: parsed.characters,
      char_count: parsed.char_count,
      layout: parsed.layout,
      side: parsed.side,
      body_part: parsed.body_part,
    })
    .eq("id", brandId);
  if (error) return respond({ success: false, message: error.message }, corsHeaders, 500);

  const bundle = await loadAnimalBundle(String(brand.animal_id), { includeDeleted: true });
  return respond({ success: true, animal: bundle }, corsHeaders, 200);
}

async function runDeleteBrand(req: Request, session: Session, body: Record<string, unknown>) {
  const corsHeaders = getCorsHeaders(req);
  const brandId = asString(body.brand_id) || asString(body.id);
  if (!brandId) return respond({ success: false, message: "brand_id is required" }, corsHeaders, 400);

  const { data: brand } = await supabase
    .from("livestock_brands")
    .select("id, animal_id")
    .eq("id", brandId)
    .maybeSingle();
  if (!brand) return respond({ success: false, message: "Brand not found" }, corsHeaders, 404);

  const animal = await loadAnimalBundle(String(brand.animal_id), { includeDeleted: true });
  if (!animal || !canAccessAnimal(session, String(animal.owner_id))) {
    return respond({ success: false, message: "Animal not found" }, corsHeaders, 404);
  }

  const { error } = await supabase.from("livestock_brands").delete().eq("id", brandId);
  if (error) return respond({ success: false, message: error.message }, corsHeaders, 500);

  const bundle = await loadAnimalBundle(String(brand.animal_id), { includeDeleted: true });
  return respond({ success: true, animal: bundle }, corsHeaders, 200);
}

async function runUpdateEarTag(req: Request, session: Session, body: Record<string, unknown>) {
  const corsHeaders = getCorsHeaders(req);
  const tagRowId = asString(body.ear_tag_id) || asString(body.id);
  if (!tagRowId) return respond({ success: false, message: "ear_tag_id is required" }, corsHeaders, 400);

  const { data: tag } = await supabase
    .from("livestock_ear_tags")
    .select("id, animal_id")
    .eq("id", tagRowId)
    .maybeSingle();
  if (!tag) return respond({ success: false, message: "Ear tag not found" }, corsHeaders, 404);

  const animal = await loadAnimalBundle(String(tag.animal_id), { includeDeleted: true });
  if (!animal || !canAccessAnimal(session, String(animal.owner_id))) {
    return respond({ success: false, message: "Animal not found" }, corsHeaders, 404);
  }

  const tag_id = asString(body.tag_id);
  if (!tag_id) return respond({ success: false, message: "tag_id is required" }, corsHeaders, 400);
  const side = asString(body.side) === "right" ? "right" : "left";

  const { error } = await supabase
    .from("livestock_ear_tags")
    .update({ tag_id, side })
    .eq("id", tagRowId);
  if (error) return respond({ success: false, message: error.message }, corsHeaders, 500);

  const bundle = await loadAnimalBundle(String(tag.animal_id), { includeDeleted: true });
  return respond({ success: true, animal: bundle }, corsHeaders, 200);
}

async function runDeleteEarTag(req: Request, session: Session, body: Record<string, unknown>) {
  const corsHeaders = getCorsHeaders(req);
  const tagRowId = asString(body.ear_tag_id) || asString(body.id);
  if (!tagRowId) return respond({ success: false, message: "ear_tag_id is required" }, corsHeaders, 400);

  const { data: tag } = await supabase
    .from("livestock_ear_tags")
    .select("id, animal_id")
    .eq("id", tagRowId)
    .maybeSingle();
  if (!tag) return respond({ success: false, message: "Ear tag not found" }, corsHeaders, 404);

  const animal = await loadAnimalBundle(String(tag.animal_id), { includeDeleted: true });
  if (!animal || !canAccessAnimal(session, String(animal.owner_id))) {
    return respond({ success: false, message: "Animal not found" }, corsHeaders, 404);
  }

  const { error } = await supabase.from("livestock_ear_tags").delete().eq("id", tagRowId);
  if (error) return respond({ success: false, message: error.message }, corsHeaders, 500);

  const bundle = await loadAnimalBundle(String(tag.animal_id), { includeDeleted: true });
  return respond({ success: true, animal: bundle }, corsHeaders, 200);
}

async function runAddPhotos(req: Request, session: Session, body: Record<string, unknown>) {
  const corsHeaders = getCorsHeaders(req);
  const id = asString(body.id) || asString(body.animal_id);
  if (!id) return respond({ success: false, message: "id is required" }, corsHeaders, 400);

  const animal = await loadAnimalBundle(id, { includeDeleted: true });
  if (!animal || !canAccessAnimal(session, String(animal.owner_id))) {
    return respond({ success: false, message: "Animal not found" }, corsHeaders, 404);
  }

  const incoming = Array.isArray(body.photos) ? body.photos : [];
  if (!incoming.length) {
    return respond({ success: false, message: "photos are required" }, corsHeaders, 400);
  }

  const existing = Array.isArray(animal.photos) ? [...animal.photos] : [];
  if (existing.length + incoming.length > 5) {
    return respond({ success: false, message: "Maximum 5 photos" }, corsHeaders, 400);
  }

  const nextPhotos = [...existing];
  for (const p of incoming) {
    if (!p || typeof p !== "object") continue;
    const row = p as Record<string, unknown>;
    const original = asString(row.original) || asString(row.path);
    if (!original) continue;
    nextPhotos.push({
      original,
      thumb: asString(row.thumb) || original,
      url: asString(row.url) || null,
    });
  }

  if (nextPhotos.length === existing.length) {
    return respond({ success: false, message: "No valid photos provided" }, corsHeaders, 400);
  }

  const { error } = await supabase
    .from("livestock_animals")
    .update({ photos: nextPhotos })
    .eq("id", id);
  if (error) return respond({ success: false, message: error.message }, corsHeaders, 500);

  const bundle = await loadAnimalBundle(id, { includeDeleted: true });
  return respond({ success: true, animal: bundle }, corsHeaders, 200);
}

async function runDeletePhoto(req: Request, session: Session, body: Record<string, unknown>) {
  const corsHeaders = getCorsHeaders(req);
  const id = asString(body.id) || asString(body.animal_id);
  if (!id) return respond({ success: false, message: "id is required" }, corsHeaders, 400);

  const animal = await loadAnimalBundle(id, { includeDeleted: true });
  if (!animal || !canAccessAnimal(session, String(animal.owner_id))) {
    return respond({ success: false, message: "Animal not found" }, corsHeaders, 404);
  }

  const photos = Array.isArray(animal.photos) ? [...animal.photos] : [];
  if (!photos.length) {
    return respond({ success: false, message: "No photos to delete" }, corsHeaders, 400);
  }

  const pathHint = normalizeStoragePhotoPath(asString(body.path) || asString(body.photo_path));
  const indexHint = asFiniteNumber(body.index);
  let removeAt = -1;
  if (pathHint) {
    removeAt = photos.findIndex((entry) => {
      if (typeof entry === "string") return normalizeStoragePhotoPath(entry) === pathHint;
      if (entry && typeof entry === "object") {
        const o = entry as Record<string, unknown>;
        const candidates = [o.original, o.thumb, o.path, o.url].map((v) => normalizeStoragePhotoPath(v));
        return candidates.includes(pathHint);
      }
      return false;
    });
  } else if (indexHint != null && indexHint >= 0 && indexHint < photos.length) {
    removeAt = Math.floor(indexHint);
  }

  if (removeAt < 0) {
    return respond({ success: false, message: "Photo not found" }, corsHeaders, 404);
  }

  if (photos.length <= 1) {
    return respond({ success: false, message: "Keep at least one photo" }, corsHeaders, 400);
  }

  const [removed] = photos.splice(removeAt, 1);
  const removedPath =
    typeof removed === "string"
      ? normalizeStoragePhotoPath(removed)
      : normalizeStoragePhotoPath(
          (removed as Record<string, unknown>)?.original ||
            (removed as Record<string, unknown>)?.thumb ||
            (removed as Record<string, unknown>)?.path,
        );

  const { error } = await supabase.from("livestock_animals").update({ photos }).eq("id", id);
  if (error) return respond({ success: false, message: error.message }, corsHeaders, 500);

  if (removedPath) {
    await supabase.from("livestock_image_embeddings").delete().eq("animal_id", id).eq("photo_path", removedPath);
    await supabase.storage.from("item-photos").remove([removedPath]);
  }

  const bundle = await loadAnimalBundle(id, { includeDeleted: true });
  return respond({ success: true, animal: bundle }, corsHeaders, 200);
}

async function runAddVocab(req: Request, session: Session, body: Record<string, unknown>) {
  const corsHeaders = getCorsHeaders(req);
  const kind = asString(body.kind); // colour | ear_mark | type
  const label = asString(body.label);
  if (!label) return respond({ success: false, message: "label is required" }, corsHeaders, 400);

  if (kind === "colour") {
    const { data, error } = await supabase
      .from("livestock_colours")
      .upsert({ label }, { onConflict: "label" })
      .select("label")
      .single();
    if (error) return respond({ success: false, message: error.message }, corsHeaders, 500);
    return respond({ success: true, colour: data.label }, corsHeaders, 200);
  }

  if (kind === "ear_mark") {
    const { data, error } = await supabase
      .from("livestock_ear_mark_types")
      .upsert({ label }, { onConflict: "label" })
      .select("label")
      .single();
    if (error) return respond({ success: false, message: error.message }, corsHeaders, 500);
    return respond({ success: true, ear_mark: data.label }, corsHeaders, 200);
  }

  if (kind === "type") {
    const code = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    if (!code) return respond({ success: false, message: "Invalid type label" }, corsHeaders, 400);

    const { data: existing, error: existingErr } = await supabase
      .from("livestock_types")
      .select("code, label, brand_bearing")
      .eq("code", code)
      .maybeSingle();
    if (existingErr) return respond({ success: false, message: existingErr.message }, corsHeaders, 500);
    if (existing) {
      return respond({ success: true, type: existing }, corsHeaders, 200);
    }

    const brand_bearing = Boolean(body.brand_bearing);
    const { data, error } = await supabase
      .from("livestock_types")
      .insert({ code, label, brand_bearing })
      .select("code, label, brand_bearing")
      .single();
    if (error) return respond({ success: false, message: error.message }, corsHeaders, 500);
    return respond({ success: true, type: data }, corsHeaders, 200);
  }

  return respond({ success: false, message: "kind must be colour, ear_mark, or type" }, corsHeaders, 400);
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const raw = await req.text();
    let body: Record<string, unknown> = {};
    if (raw.trim()) {
      try {
        body = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return respond({ success: false, message: "Invalid JSON" }, corsHeaders, 400);
      }
    }

    const operation = asString(body.operation) || asString(body.op);
    const publicOps = new Set([
      "livestock-get-vocab",
      "livestock-search-text",
      "livestock-search-photo",
      "livestock-pick-sighting",
    ]);

    let session: Session | null = null;
    if (!publicOps.has(operation)) {
      const gate = await requireUser(req);
      if (gate.res) return gate.res;
      session = gate.session;
    } else {
      // Optional auth for pick
      const auth = req.headers.get("authorization") || req.headers.get("Authorization");
      session = (await validateSession(supabase, auth)) as Session | null;
    }

    switch (operation) {
      case "livestock-get-vocab":
        return await runGetVocab(req);
      case "livestock-get-pack-status":
        return await runGetPackStatus(req, session!, body);
      case "livestock-buy-pack":
        return await runBuyPack(req, session!);
      case "livestock-list-mine":
        return await runListMine(req, session!, body);
      case "livestock-get-mine":
        return await runGetMine(req, session!, body);
      case "livestock-register":
        return await runRegister(req, session!, body);
      case "livestock-search-text":
        return await runSearchText(req, body);
      case "livestock-search-photo":
        return await runSearchPhoto(req, body);
      case "livestock-pick-sighting":
        return await runPickSighting(req, body);
      case "livestock-list-sightings":
        return await runListSightings(req, session!);
      case "livestock-decide-sighting":
        return await runDecideSighting(req, session!, body);
      case "livestock-reveal-sighting":
        return await runRevealSighting(req, session!, body);
      case "livestock-sign-uploads":
        return await runSignPhotoUploads(req, session!, body);
      case "livestock-store-embedding":
        return await runStoreEmbedding(req, session!, body);
      case "livestock-set-status":
        return await runSetStatus(req, session!, body);
      case "livestock-update-mine":
        return await runUpdateMine(req, session!, body);
      case "livestock-add-brand":
        return await runAddBrand(req, session!, body);
      case "livestock-update-brand":
        return await runUpdateBrand(req, session!, body);
      case "livestock-delete-brand":
        return await runDeleteBrand(req, session!, body);
      case "livestock-add-ear-tag":
        return await runAddEarTag(req, session!, body);
      case "livestock-update-ear-tag":
        return await runUpdateEarTag(req, session!, body);
      case "livestock-delete-ear-tag":
        return await runDeleteEarTag(req, session!, body);
      case "livestock-add-photos":
        return await runAddPhotos(req, session!, body);
      case "livestock-delete-photo":
        return await runDeletePhoto(req, session!, body);
      case "livestock-add-vocab":
        return await runAddVocab(req, session!, body);
      default:
        return respond({ success: false, message: `Unknown operation: ${operation || "(none)"}` }, corsHeaders, 400);
    }
  } catch (e) {
    console.error("livestock-api:", e);
    return respond(
      { success: false, message: e instanceof Error ? e.message : "Server error" },
      corsHeaders,
      500,
    );
  }
});
