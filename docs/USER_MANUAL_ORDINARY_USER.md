# iRegistry — User guide (ordinary account)

This guide is for people who use iRegistry with a **standard user** account (the default role after sign-up). It describes the main screens and everyday tasks. Admin, police, and cashier tools are covered in separate manuals.

---

## 1. What iRegistry is for

iRegistry helps you **register valuable items** (with photos and serials), **prove ownership**, and work with **police and recovery** if something is lost or stolen. Your **user dashboard** is the home for everything tied to your account: items, alerts, credits, and profile details.

### 1.1 Your digital “info bank” (keep proof in one place)

Think of iRegistry as your personal **information bank** for valuables.

After you buy something important, add it to iRegistry and keep all the key details together — serial numbers, photos, and supporting proof. Later, when you need to **prove ownership**, **sell responsibly**, **insure**, **travel**, or **report theft**, you are not searching for papers or old messages: your record is already organized and time‑stamped.

**Catchy rule:** *Buy it → Register it → Keep it safe.*

### 1.2 Safety of your information

iRegistry is built to protect user information:

- Your item records are tied to your account and are not meant to be publicly browsed like a social profile.
- Sensitive actions (editing, transfers, notifications) require being signed in and using the permissions your registry allows.
- If you think your account is at risk, use **Profile → Sessions / trusted devices** and sign out old sessions.

---

## 2. Verification (Buyer Protection) — check before you buy

Verification is the **primary feature** of iRegistry for day-to-day safety: it helps you check an item **before you buy** (or before you accept it) so you do not accidentally purchase stolen property.

Verification is **free to use** and is available to **everyone**:

- You can check a serial number from the home page **while logged out** (public use).
- You can also verify while **logged in** — and may see extra actions after a match is found.

Because verification is public and free, iRegistry is also **self‑protecting**: if checks are heavily repeated or appear abusive, the app may temporarily **limit** the number of checks or ask you to **sign in / use credits** to continue. This keeps the service reliable for normal users.

### 2.1 What you can verify

- **Serial number verification**: Type the serial number exactly as printed on the device label, packaging, or in the device settings.
- **Photo verification (where available)**: Use your camera to capture the item label/serial area. The app tries to read and match what it sees.

### 2.2 How to verify by serial number

1. On the home page, open **Buyer Protection Verification**.
2. Enter the item’s **serial number**.
3. Tap **Verify**.
4. Read the result and follow the guidance in **2.4 What the results mean**.

**Tips for better results**

- Type carefully — a single wrong character can change the outcome.
- Check multiple labels if the item has more than one identifier (e.g. device serial vs box serial).
- If a seller cannot provide a serial number, treat that as a risk and ask for proof of ownership.

### 2.3 How to verify by photo (camera)

1. Tap the **camera** option in the verification panel.
2. Hold the device steady and aim at the **serial label** or identifying plate.
3. Let the app capture a photo (or capture manually if prompted).
4. Wait for the result.

**Tips for better photo checks**

- Use good lighting (avoid glare and reflections).
- Move closer so the serial label is readable.
- Keep the serial label centered in the frame.

### 2.4 What the results mean

iRegistry normally shows one of these outcomes:

- **Not found in registry**: The serial is not currently registered.
  - This does **not** prove the item is safe.
  - Ask the seller for proof of ownership (receipt, matching box, or other evidence).
- **Found / Registered**: The serial belongs to an item that is registered to someone.
  - Ask the seller to show proof that they are the registered owner (or have the right to sell it).
  - If you are logged in, you may be able to contact the registered owner through the app.
- **Warning / Reported stolen**: The serial matches an item that was reported stolen.
  - **Do not buy** the item.
  - Follow the app guidance for reporting or notifying the owner if available.

### 2.5 What you can do next (after a match)

Depending on your role and deployment, the verification screen may allow actions such as:

- **Notify the registered owner**: Send a message to the owner so they are aware that the item was seen or offered for sale.
- **Request ownership transfer (logged-in)**: If the seller claims the item is legitimately yours (or is being sold to you), you can request a transfer. The registered owner must approve.
- **Inform law enforcement (for stolen matches, where enabled)**: Some deployments include an option to flag the sighting to support recovery workflows.

**Important**

- Verification is a safety check and a record signal. It does not replace legal ownership documents.
- Always use common sense: if anything looks suspicious, do not proceed with the purchase.

---

## 3. Signing in

1. Open the **Login** page.
2. Enter your **last name** and **ID number** exactly as registered (national ID or passport, as used on your account).
3. The app finds your account and sends a **one-time code (OTP)**. You may be asked to choose **email** or **SMS**, depending on what is on file and device trust rules.
4. Enter the code to complete sign-in.

**Tips**

- If you use more than one browser or device, you may need to verify by **email first** on a new device before SMS is offered.
- Your account may allow **up to two active sessions**. If you are at the limit, sign in will ask you to **sign out one existing session** before continuing.
- After login, you are usually taken to your **dashboard** (`/user`), or back to a page you tried to open before logging in.

**Signing up**

- New accounts are created from **Sign up**. You will complete steps with contact details and location so your profile can be completed later in **Profile**.

---

## 4. Finding your way around (user dashboard)

When you are logged in as an ordinary user, the **left sidebar** (expand it by moving the pointer over the green bar) includes:

| Area | Purpose |
|------|--------|
| **Dashboard** | Snapshot: active/stolen counts, notifications, recent activity |
| **Profile** | Your personal and contact details, account identifiers |
| **Items** | Opens a submenu: **Active Items**, **Deleted Items**, **Legacy items** |
| **Notifications** | Alerts about your items (e.g. contact attempts) |
| **Activity** | Broader activity feed for your account |
| **Transactions** | Credit purchases and movements (top-ups, charges where applicable) |
| **Organizations** | Invitations, memberships, and (where enabled) organization items and wallet |
| **Top up** | Add credits to your account (where available) |
| **Pricing** | What actions cost in credits and how billing works |

**URLs (for reference)**  
All of these live under `/user/…` — for example `/user/items`, `/user/profile`.

---

## 5. Dashboard home

The **Dashboard** page summarizes:

- **Active items** — items currently registered as normal (not reported stolen in a way that counts here as “stolen” for the summary).
- **Stolen items** — items reported as stolen (needs attention).
- **Notifications** — unread vs total alerts.
- **Credits** — a summary strip with balance and shortcuts to **Pricing** and **Transactions** (when shown).

You may also see **recent activity** and shortcuts such as **Add your first item** if you have not registered anything yet.

---

## 6. Profile

**Profile** holds information used to identify you and reach you:

- Name, email, phone, location fields (village, ward, police station, etc.) as configured for your deployment.
- **Registry account ID** — internal system identifier; useful if support asks for it.
- **Registry history** — a short timeline of important account events (e.g. profile updates), where enabled.

Keep your phone and email accurate so OTP and alerts work.

### 6.1 Sessions and trusted devices (security)

Depending on your deployment, **Profile** may also show security tools such as:

- **Active sessions**: see where your account is currently signed in, and sign out old sessions if needed.
- **Trusted devices**: devices you have approved for easier login (for example, where SMS/OTP rules are relaxed).

Use these tools on shared devices, or if you suspect someone else may have access to your account.

---

## 7. Items — active, deleted, and legacy

### 7.1 Active Items

**Active Items** lists things you still treat as current registrations. From here you can:

- **Search and filter** (e.g. by category or status where available).
- **Open an item** to see full details (public-style view).
- **Edit** an item (where allowed), **report stolen**, move to **legacy**, or **delete** (soft delete), depending on policy and credits.
 - **Export** (where available): download your list as a file for personal record-keeping.

**Adding a new item**

- Use **+ Add Item** (or equivalent) from the items area or dashboard.  
- Registration usually opens the **Add item** flow at `/items/add`.  
- Some actions may **cost credits** after free allowances; the app should show **cost and balance** before you confirm.

**Organization-assigned items (if enabled)**

Some ordinary users can be assigned items that belong to an organization (for example, a company phone or tool). These items may appear alongside your own items, but will show an organization label. Your actions may be limited by the organization’s policy.

### 7.2 Deleted Items

**Deleted Items** lists items you (or someone allowed) **removed** from the active list but that can often be **restored**. Use this if you deleted something by mistake.

### 7.3 Legacy items

**Legacy** is for items that are **obsolete or kept for reference** (no longer in your main active list). You may **restore** an item back to active when policy allows.

---

## 8. Item details and editing

- **View**: Open an item from the list; details are shown using the item’s link (e.g. `/items/your-item-slug`).
- **Edit**: Where you have permission, use edit to update photos, description, location, or status — subject to **credit rules** for certain changes.

If something fails because of **insufficient credits**, the app should tell you and point you to **Pricing** or **Top up**.

### 8.1 Reporting stolen and recovery steps

If an item is stolen:

- Use the item actions to **report it stolen** (or mark it as active again if recovered).
- If your deployment supports it, you may see a **police case** section with simple status steps (for example “Open”, “In custody”, “Cleared for return”, “Returned to owner”).

Always follow official reporting requirements outside the app as directed by your organization.

### 8.2 Photos and supporting documents

Item photos are not only for appearance — they are evidence.

- Add clear photos of the item, including the **serial label**.
- Where possible, include supporting proof such as a **receipt photo** or **warranty label** within the allowed photo slots.
- The first photo is typically used as the **main image** in lists and on the item page.

### 8.3 Deleting, restoring, and legacy

The system may support “soft delete” and legacy storage so you can correct mistakes:

- **Delete**: removes an item from your active list (depending on your role/policy).
- **Deleted items**: you can often **restore** a deleted item later.
- **Move to legacy**: hides an item from your active list but keeps it for reference; you can restore it back to active.

### 8.4 Ownership transfers (when applicable)

If someone tries to claim or buy an item that is registered to you, the system may allow an **ownership transfer request**:

- You may see **pending transfer requests** on your dashboard.
- Approving a request moves the item to the requester’s account (and may use credits depending on policy).
- Rejecting keeps the item under your account.

---

## 9. Notifications

**Notifications** lists events such as someone trying to reach you about a registered item. Mark alerts as read when you have handled them so your dashboard stays clear.

Tip: Some screens also group alerts by item. Opening the item and marking its alerts as read will reduce the unread count.

---

## 10. Activity

**Activity** shows a wider stream of what happened on your account (for example item-related events), beyond a single short list on the dashboard. Exact content depends on system configuration.

---

## 11. Credits, pricing, and transactions

Many operations use **credits** (a balance on your account).

- **Pricing** (`/user/pricing`) — explains **costs** for actions (e.g. registering extra items, certain updates).
- **Top up** (`/user/topup`) — add credits when your organization supports self-serve top-up; otherwise you may be directed to a **cashier** or other channel.
- **Transactions** (`/user/transactions`) — history of top-ups and charges so you can reconcile your balance.

The **credits strip** on the dashboard often shows **balance** and quick links to these pages.

---

## 12. Organizations (memberships, invitations, and wallets)

If your account is linked to organizations, you can manage that under **Organizations**:

- **Invitations**: accept or reject an invitation to join an organization.
- **My organizations**: open an organization to view its **wallet** (where enabled) or **items** list.

Organizations are typically used for workplaces, schools, shops, or institutions that register or manage items on behalf of users.

---

## 13. Signing out and security

- Use **Sign out** / logout in the header or account menu when you finish on a shared computer.
- You can manage **active sessions** where the product exposes that option (e.g. signing out other devices).

---

## 14. If something goes wrong

- **Login fails** — Check last name and ID, wait for a new OTP if the old one expired, and try another channel (email vs SMS) if offered.
- **“Insufficient credits”** — Check **Pricing**, then **Top up** or ask your registry how to add credits.
- **Wrong list after opening the site** — Refresh the page or open **Items** again from the sidebar; lists load from the server when you open each section.

For account or data issues that the app cannot solve, use the **support channel** your organization provides (email, desk, or phone).

---

## 15. Glossary (quick)

| Term | Meaning |
|------|--------|
| **Active item** | Currently in your main registered list. |
| **Stolen** | Reported as stolen; may open or link to a police case depending on setup. |
| **Deleted (soft)** | Removed from the active list but may be restored from **Deleted Items**. |
| **Legacy** | Set aside for reference; can often be restored to active. |
| **Credits** | Balance spent on certain paid actions. |
| **OTP** | One-time passcode for login or verification. |

---

*Document version: 1.1 — ordinary user scope. Align section numbers if you add role-specific manuals later.*
