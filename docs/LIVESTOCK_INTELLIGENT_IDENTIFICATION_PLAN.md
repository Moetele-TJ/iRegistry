# Livestock Intelligent Identification — Master Plan

Status: **Phase 1 in progress** — DB migration, `livestock-api` edge function, Verification Livestock tab, and owner routes (`/user/livestock*`) landed locally; apply migration + deploy function before production use.  
Product: iRegistry module (new schemas; do **not** force into serial `items`)  
Last updated: 2026-09-05

---

## 1. Vision

Owners register animals with structured details and photos. Those photos form the search corpus.

The public **Verification panel** has two tabs: **Items** (existing serial/photo verify) and **Livestock** (animal identify). On Livestock, a stranger can take/upload photos **or** search by **ear tag ID** or **brand**, get a shortlist (photos-first, limited text), pick a match, and the system notifies the owner with a sighting that includes where the animal was seen. The owner accepts or rejects using knowledge of home vs astray; after accept, **Reveal location** works the same as for photo sightings.

```text
Owner enrolls animal + photos (+ brands / ear tags)
        ↓
Public Verification → tab “Livestock”
        ↓
Photo path OR ear-tag / brand text path (+ GPS if allowed)
        ↓
Shortlist (photos primary, limited info) → stranger picks best
        ↓
Notify owner(s) of chosen match (sighting + captured location)
        ↓
Owner accepts or rejects (home vs astray judgment)
        ↓
If accepted + GPS exists → “Reveal location” (2 credits) → map pin
```

---

## 1.1 Naming: “Livestock” vs alternatives

**Recommendation: keep the tab label `Livestock` for v1**, with a short subtitle if needed (e.g. “Cattle, goats, dogs & more”).

| Label | Pros | Cons |
|--------|------|------|
| **Livestock** | Clear farming / Botswana stock register feel; matches “farmer finds animals” story | Strictly speaking, **dogs** are pets/companion animals, not livestock |
| **Animals** | Accurate for cattle + goats + dogs | Less “farm register” tone; broader / softer |
| **Stock** | Common Southern African farm English | May confuse non-farm users; less clear for dogs |
| **Animal ID** | Describes the action | Longer; less parallel to “Items” |

**Dogs in the type list:** If dogs remain first-class, either keep **Livestock** as the product name (farm-first) or switch the tab to **Animals** for correctness. Schema/module can stay `livestock_*` internally even if the UI says “Animals.”

**Decision for plan:** UI tab **`Livestock`** unless product prefers **`Animals`** before build.

---

## 2. Locked product decisions

| # | Topic | Decision |
|---|--------|----------|
| 1 | Scope | Part of **iRegistry**; **new schemas** — not overloaded onto `items` |
| 2 | Strangers | **Public** by default; **optional login** to attach more identity/contact |
| 3 | Location | Sighting GPS + animal **dwelling**; notify **distance only** (“some X km away”); exact pin after accept + Reveal |
| 4 | Match confirm | Shortlist → stranger picks → notify owner(s); **owner accept/reject**; **owner accept** then unlocks reveal |
| 5 | Brands | Structured layouts + side + body part (see §4) |
| 6 | Types | Seeded list + **add new** |
| 7 | Billing | Free sightings; **2 credits** to reveal after owner accept; registration packs (see §7) |
| 8 | Vocab | **Setswana** colour / ear-mark seeds + **add more** |
| 9 | Shortlist | Photo: similarity **≥ 85%**, prefer **≥ 90%**; text: ear tag / brand matches; stranger picks |
| 10 | Notify | On stranger **pick**, notify owner with **distance-from-dwelling** + identity phrase |
| 11 | Stranger pick | Required to create the sighting notification path; also boosts confidence |
| 12 | Photo quality | Reject **blurry / low-resolution** photos |
| 13 | Herd shots | Goal: identify animal among others if **body marks visible**; expect crop/detect for accuracy |
| 14 | Verification UI | **Two tabs:** Items (unchanged) · Livestock (photo + ear tag / brand) |
| 15 | Text search shortlist | Limited info; **saved photos are the main focus** |
| 16 | Notify identity | Prefer **name**; else breed / colour / brand / tag ID |
| 17 | Dwelling | Stored on animal; required for distance notifications |

---

## 3. Actors & surfaces

### 3.1 Owner (logged-in farmer)

- Register / edit / list animals  
- Upload enrollment photos (quality-gated)  
- View sighting notifications  
- **Accept or reject** sightings (using knowledge of home location vs animal astray)  
- After accept: **Reveal location** (paid) → map pin  
- See remaining registration pack balance  

### 3.2 Stranger (public)

- Home / verification: **Livestock** tab  
- Capture / upload photo(s) **or** type **ear tag ID** or **brand**  
- Grant location if willing (especially important for sightings)  
- Pass quality gate (photos)  
- View shortlist (photos primary); pick best or “none”  
- Optional: log in to leave contact details  

### 3.3 System

- Embed livestock photos (scoped separately from device `items`)  
- Rate-limit public identify / text search / upload  
- Store sightings with GPS when available  
- Notify owner after stranger picks a match  

### 3.4 Verification panel (public)

| Tab | Behaviour |
|-----|-----------|
| **Items** | Existing serial + photo verification — **unchanged** |
| **Livestock** | Animal identify (below) |

**Livestock tab — two search modes**

1. **Photo** — take / upload (quality-gated) → visual shortlist → pick  
2. **Ear tag ID or brand** — type query → shortlist of matching animals → pick  

**Shortlist presentation (both modes)**

- **Photos are the primary focus** (enrollment images)  
- Text fields limited (e.g. type, colour, masked/partial tag — not full owner PII)  
- User picks the best match (or none)  

**After pick (photo or text)**

1. Create sighting linked to chosen animal  
2. Attach stranger GPS / place metadata when available  
3. Notify the **owner** of that animal  
4. Owner **accepts** or **rejects** based on whether the reported place fits “home” or “currently astray”  
5. If **accepted** and GPS exists → same as photo path: **Reveal location** (2 credits) → map pin  

Suggested owner routes: `/livestock`, `/livestock/register`, `/livestock/:id`, sightings inbox.  
Public identify stays on the shared **Verification panel** (Items | Livestock).

---

## 4. Animal identity model

### 4.1 Core fields

| Field | Notes |
|--------|--------|
| Type | Cattle, Goat, Sheep, Dog, Donkey, Horse, Camel, Mule (+ add new) |
| Gender | |
| Breed | e.g. Brahman, Boer Goat, Jack Russell (+ free text / add) |
| Colour | Setswana seeds e.g. Tshumu, Kgwana, Khunohu (+ add more) |
| Name | Display name — used in sighting notifications when set |
| Home / dwelling location | **Required for distance alerts:** coordinates (preferred) and/or village/ward as dwelling point; compared to sighting GPS (“some X km away”) |
| Status | e.g. active / missing / recovered (phase as needed) |
| Photos | Multiple; required for matching; quality-gated |

### 4.2 Type-conditional: brands

**Brand-bearing types (v1):** Cattle, Donkey, Horse, Camel, Mule  

**Non-brand types:** Goat, Sheep, Dog (and similar) — hide brand UI; rely on colour, ear marks, ear tags, photos.

### 4.3 Brands (up to 4)

- Characters: **3** or **4** letters/numbers  
- **3-character layouts:**  
  - Horizontal  
  - Vertical  
  - Two up, one below  
  - One up, two below  
- **4-character layout:** Square  
- **Side:** Left or Right  
- **Body part:** Shoulder, Thigh, **Flank**, **Neck**  

Plus **zone brand** (separate field / mark).

### 4.4 Ear marks

- Seeded Setswana terms: **Lesifi**, **Letsekana**, **Kwena** (+ add more)  
- Side if needed (left / right) — confirm in UI design  

### 4.5 Ear tags (up to 2)

- Tag ID / number  
- Side: Left / Right  

Closest human-readable identifier when not using device-style serials.

---

## 5. Sightings & location

### 5.1 Why GPS matters

Without location, a sighting only proves “seen / alive.”  
With location, farmers can **decide** accept/reject (home vs astray) and later **go to** the pin.

- Always **ask** for location on Livestock identify (photo and text modes) with clear purpose copy.  
- Prefer **browser geolocation**; retain EXIF coords when present.  
- If denied: still allow search/pick; sighting may have **no coordinates**; **Reveal** N/A / disabled.  

### 5.2 Notification, accept/reject, reveal

Applies to **photo** and **ear-tag / brand** picks alike.

1. Stranger picks a shortlist animal → sighting created (with GPS when available).  
2. **Owner is notified** with a **distance-from-home** message (not a precise pin) — enough to judge home vs astray.  
3. Owner **accepts** or **rejects**.  
4. If **accepted** and coordinates exist → **“Reveal location”** → confirm → **2 credits** → interactive **map pin**.  

#### Owner notification copy (distance, not exact pin)

Requires each animal to have a **dwelling / home location** (kraal / homestead coordinates or geocoded village point — see registration fields). Sighting GPS is compared to dwelling to compute distance.

Examples:

- With name: *“Your animal **Thabo** was located some **5 km** away.”*  
- Without name: *“Your animal (**Brahman**, **Tshumu**, brand **…** / tag **…**) was located some **2 km** away.”*

**Identity phrase in the message (priority):**

1. **Name** if present  
2. Else a short descriptor from available fields: **breed**, **colour**, **brand**, and/or **ear tag ID** (whatever is registered)

**Distance banding (illustrative):** round or bucket for privacy, e.g. “less than 1 km”, “about 2 km”, “about 5 km”, “about 10 km”, “more than 10 km” — exact bands set at implementation. Never include lat/lng or a map pin in the notification.

If sighting has **no GPS**, or animal has **no dwelling** location: notify without distance (e.g. “A possible sighting of **Thabo** was reported”) and disable or defer Reveal until both exist.

#### Concealment vs reveal

| Audience | What they see |
|----------|----------------|
| Public / stranger | No owner dwelling; no precise sighting pin |
| Owner (notification / before accept) | **Distance from dwelling** + animal identity phrase only |
| Owner (after accept + paid Reveal) | **Exact map pin** of the sighting |

### 5.3 Confirmation rules

| Actor | Action | Effect |
|--------|--------|--------|
| System | Build shortlist (vision and/or ear tag / brand) | Auto |
| Stranger | Pick best (or none) | Creates sighting + notifies owner; boosts confidence; “none” stops |
| Owner | Accept / reject | Accept required before Reveal; reject closes sighting |
| Owner | Reveal location | **2 credits**; map pin |

**Unlock reveal = owner accept only** (not dual stranger+owner required).

Dwelling location is **required for distance notifications** (and strongly encouraged at registration). Exact dwelling coordinates are **never** shown to strangers.

---

## 6. Matching rules

### 6.1 Threshold & shortlist

- Candidates enter shortlist only if similarity is **significantly high**: **≥ 0.85**, start operational default **≥ 0.90**.  
- Stranger sees a **short list** and picks the best according to them.  
- **All owners** of shortlisted animals get notified to confirm or reject.  
- Zero candidates above threshold → “No strong match”; no owner spam.  

Exact cutoffs tuned with real Botswana photos after pilot.

### 6.2 Photo quality gate

Reject before search / enrollment when:

- Too blurry / soft  
- Too dark / washed out  
- Below minimum resolution (exact limits set at implementation)  

User message example: *“Photo is too blurry or low quality. Move closer, hold steady, and try again.”*

Apply to **both** stranger sightings and owner enrollment photos.

### 6.3 Animals among a herd

**Goal:** Identify an animal even among others if body marks are visible.

**v1 approach:**

- Capture guidance: frame so brand / ear marks / tags are clear; other animals OK if marks visible.  
- Prefer **detect → crop animal → embed crop** (see §8).  
- Whole-image-only matching is a known risk; improve with crop/focus after field tests.  

---

## 7. Billing

Ledger uses **integer credits**. Avoid fractional (0.5) costs.

### 7.1 Registration packs

| Band | Cost |
|------|------|
| Lifetime registrations **1–2** | **Free** |
| From **3rd** onward | **5 credits** unlocks a **pack of 10** registrations (current submission + remaining slots in pack) |
| Pack exhausted | Pay **5** again for the next 10 |

Example: after 2 free, pay 5 → animals **#3–#12**. Next pack → **#13–#22**.

Show pack remaining in owner UI (“7 of 10 left in pack”).

### 7.2 Sightings & reveal

| Action | Cost |
|--------|------|
| Create / browse sighting (stranger) | **Free** |
| Owner confirm / reject | **Free** |
| **Reveal location** (after owner confirm, GPS present) | **2 credits** |

### 7.3 Task catalog (proposed codes)

- `LIVESTOCK_REGISTER_PACK` — 5 credits (grants 10 registration slots)  
- Or debit pack on first paid registration and track `livestock_registration_credits` / slots on user  
- `LIVESTOCK_REVEAL_LOCATION` — 2 credits  

Exact debit timing (pay when opening pack vs when submitting 3rd animal) to be specified in implementation design; behaviour must match the pack table above.

---

## 8. AI / embeddings strategy

### 8.1 Current iRegistry stack

- Replicate image embedding → `image_embeddings` / vector RPC  
- Tuned for **device / item** photos, thresholds ~0.90–0.95  
- **Not proven** as livestock instance re-ID  

**Pipeline shape is reusable; model fitness for livestock is not assumed.**

### 8.2 Recommended approach

| Stage | Approach |
|--------|----------|
| Prototype | Existing embed pipeline + livestock scope + quality gate |
| v1 | **Detect/segment animal → embed crop**; stronger backbone (e.g. **DINOv2** / **SigLIP** class) |
| v1.5+ | **Fine-tune metric learning / animal re-ID** on enrolled Botswana livestock photos |
| Always | Structured filters (type, colour, tags) to narrow candidates |

Do **not** rely on Holstein-only farm CCTV models as a drop-in for Brahman / local colours / brands.  
Do **not** require RGB-D for stranger phone photos.

### 8.3 Enrollment photo guidance

Encourage multiple angles: left/right side, brand close-up, head / ear tags — improves re-ID regardless of backbone.

---

## 9. Proposed schemas (sketch)

Names illustrative; finalize in migration design.

- `livestock_types` — seeded + user-addable  
- `livestock_colours` — Setswana seeds + addable  
- `livestock_ear_mark_types` — Lesifi, Letsekana, Kwena + addable  
- `livestock_animals` — owner, type, gender, breed, colour, name, **dwelling lat/lng** (and/or village/ward), status, timestamps  
- `livestock_brands` — animal_id, characters, layout enum, side, body_part, sort (max 4)  
- `livestock_zone_brands` — or columns on animal  
- `livestock_ear_marks` — type + optional side  
- `livestock_ear_tags` — tag_id, side (max 2)  
- `livestock_photos` — paths, quality metadata, embedding linkage  
- Embeddings: livestock-scoped table or `image_embeddings` with `animal_id` / domain flag  
- `livestock_sightings` — photos, lat/lng/accuracy (nullable), stranger_user_id (nullable), shortlist session, matched animal(s), stranger_pick_animal_id, owner_confirm status, confidence, location_revealed_at, status  
- `livestock_sighting_candidates` — sighting_id, animal_id, similarity, owner_decision  
- User pack state: e.g. `livestock_registration_slots_remaining` or pack ledger rows  

Reuse patterns: signed uploads, notification system, credit ledger / `task_catalog`, village/ward/station selectors where relevant.

---

## 10. Phased delivery

### Phase 0 — Prep

- [ ] Finalize seed lists (colours, ear marks, type metadata: brand-bearing flag)  
- [ ] Confirm pack debit UX copy  
- [ ] Choose v1 embedding path (current vs DINOv2/SigLIP + crop)  
- [ ] Map pin provider (e.g. existing stack / Leaflet / Google)  

### Phase 1 — Foundation

- [ ] Migrations for livestock schemas + RLS / service_role access  
- [ ] Task codes + pack + reveal billing  
- [ ] Owner register / list / detail (type-conditional brands)  
- [ ] Photo upload + quality gate + embeddings enqueue  
- [ ] **Verification panel:** Items | Livestock tabs  
- [ ] Livestock photo identify → shortlist → pick  
- [ ] Livestock ear-tag / brand search → shortlist (photos-first) → pick  
- [ ] Notify owner on pick (**distance from dwelling** + name or breed/colour/brand/tag); accept / reject; Reveal location (2 credits) → pin  

### Phase 2 — Robustness

- [ ] Detect/crop pipeline for herd shots  
- [ ] Stronger / fine-tuned re-ID model after pilot metrics  
- [ ] Abuse rate limits, retention policy for stranger photos  
- [ ] Missing / recovered status, richer owner inbox  

### Phase 3 — Optional

- [ ] Police / station handoff for livestock  
- [ ] Offline-friendly capture for cattle posts  
- [ ] Analytics on match precision/recall  

---

## 11. Privacy, abuse, ops

- Public uploads: rate limits, max photo size/count, malware-safe types  
- Concealed GPS: never expose in APIs until reveal succeeds  
- Stranger optional identity: clear consent if contact shared with owner  
- Embedding queue monitoring (align with `docs/user-items-gaps.md` embedding ops)  
- Retain / purge policy for rejected or unmatched stranger photos  

---

## 12. Success criteria (pilot)

- Enrollment: owners can register brand-bearing and non-brand animals with correct fields  
- Quality gate rejects clearly blurry samples  
- Shortlist rarely includes below-threshold noise (tune toward 90%)  
- Owner confirm → reveal → correct pin when GPS present  
- Pack billing: 2 free, then 5 credits / 10 animals; reveal 2 credits  
- Documented match rates on a held-out set of real Botswana photos before promising herd-level accuracy  

---

## 13. Out of scope (for this plan)

- Forcing livestock into `items` category/make/model/serial  
- Replacing the existing device photo-verify product  
- Guaranteeing perfect herd ID with the current item embedding model alone  

---

## 14. Open implementation details (non-blocking for this plan)

- Exact min resolution / blur score thresholds  
- Max shortlist length (e.g. top 5)  
- Whether one sighting row per shortlist session vs per candidate  
- Map SDK choice  
- Final Replicate / self-hosted model IDs for DINOv2/SigLIP  

---

## 15. Document history

| Date | Change |
|------|--------|
| 2026-09-05 | Initial master plan from product planning sessions |
| 2026-09-05 | Verification panel tabs; naming note; ear-tag/brand search → pick → owner accept/reject → reveal |
| 2026-09-05 | Owner notify: distance from dwelling; identity by name or breed/colour/brand/tag |
