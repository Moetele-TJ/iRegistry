# iRegistry — User guide (ordinary account)

This guide is for people who use iRegistry with a **standard user** account (the default role after sign-up). It describes the main screens and everyday tasks. Admin, police, and cashier tools are covered in separate manuals.

---

## 1. What iRegistry is for

iRegistry helps you **register valuable items** (with photos and serials), **prove ownership**, and work with **police and recovery** if something is lost or stolen. Your **user dashboard** is the home for everything tied to your account: items, alerts, credits, and profile details.

---

## 2. Signing in

1. Open the **Login** page.
2. Enter your **last name** and **ID number** exactly as registered (national ID or passport, as used on your account).
3. The app finds your account and sends a **one-time code (OTP)**. You may be asked to choose **email** or **SMS**, depending on what is on file and device trust rules.
4. Enter the code to complete sign-in.

**Tips**

- If you use more than one browser or device, you may need to verify by **email first** on a new device before SMS is offered.
- Your account may allow **up to two active sessions**. If you are at the limit, sign in will ask you to **sign out one existing session** before continuing.
- After login, you are usually taken to your **dashboard** (`/userdashboard`), or back to a page you tried to open before logging in.

**Signing up**

- New accounts are created from **Sign up**. You will complete steps with contact details and location so your profile can be completed later in **Profile**.

---

## 3. Finding your way around (user dashboard)

When you are logged in as an ordinary user, the **left sidebar** (expand it by moving the pointer over the green bar) includes:

| Area | Purpose |
|------|--------|
| **Dashboard** | Snapshot: active/stolen counts, notifications, recent activity |
| **Profile** | Your personal and contact details, account identifiers |
| **Items** | Opens a submenu: **Active Items**, **Deleted Items**, **Legacy items** |
| **Notifications** | Alerts about your items (e.g. contact attempts) |
| **Activity** | Broader activity feed for your account |
| **Transactions** | Credit purchases and movements (top-ups, charges where applicable) |
| **Top up** | Add credits to your account (where available) |
| **Pricing** | What actions cost in credits and how billing works |

**URLs (for reference)**  
All of these live under `/userdashboard/…` — for example `/userdashboard/items`, `/userdashboard/profile`.

---

## 4. Dashboard home

The **Dashboard** page summarizes:

- **Active items** — items currently registered as normal (not reported stolen in a way that counts here as “stolen” for the summary).
- **Stolen items** — items reported as stolen (needs attention).
- **Notifications** — unread vs total alerts.
- **Credits** — a summary strip with balance and shortcuts to **Pricing** and **Transactions** (when shown).

You may also see **recent activity** and shortcuts such as **Add your first item** if you have not registered anything yet.

---

## 5. Profile

**Profile** holds information used to identify you and reach you:

- Name, email, phone, location fields (village, ward, police station, etc.) as configured for your deployment.
- **Registry account ID** — internal system identifier; useful if support asks for it.
- **Registry history** — a short timeline of important account events (e.g. profile updates), where enabled.

Keep your phone and email accurate so OTP and alerts work.

---

## 6. Items — active, deleted, and legacy

### 6.1 Active Items

**Active Items** lists things you still treat as current registrations. From here you can:

- **Search and filter** (e.g. by category or status where available).
- **Open an item** to see full details (public-style view).
- **Edit** an item (where allowed), **report stolen**, move to **legacy**, or **delete** (soft delete), depending on policy and credits.

**Adding a new item**

- Use **+ Add Item** (or equivalent) from the items area or dashboard.  
- Registration usually opens the **Add item** flow at `/items/add`.  
- Some actions may **cost credits** after free allowances; the app should show **cost and balance** before you confirm.

### 6.2 Deleted Items

**Deleted Items** lists items you (or someone allowed) **removed** from the active list but that can often be **restored**. Use this if you deleted something by mistake.

### 6.3 Legacy items

**Legacy** is for items that are **obsolete or kept for reference** (no longer in your main active list). You may **restore** an item back to active when policy allows.

---

## 7. Item details and editing

- **View**: Open an item from the list; details are shown using the item’s link (e.g. `/items/your-item-slug`).
- **Edit**: Where you have permission, use edit to update photos, description, location, or status — subject to **credit rules** for certain changes.

If something fails because of **insufficient credits**, the app should tell you and point you to **Pricing** or **Top up**.

---

## 8. Notifications

**Notifications** lists events such as someone trying to reach you about a registered item. Mark alerts as read when you have handled them so your dashboard stays clear.

---

## 9. Activity

**Activity** shows a wider stream of what happened on your account (for example item-related events), beyond a single short list on the dashboard. Exact content depends on system configuration.

---

## 10. Credits, pricing, and transactions

Many operations use **credits** (a balance on your account).

- **Pricing** (`/userdashboard/pricing`) — explains **costs** for actions (e.g. registering extra items, certain updates).
- **Top up** (`/userdashboard/topup`) — add credits when your organization supports self-serve top-up; otherwise you may be directed to a **cashier** or other channel.
- **Transactions** (`/userdashboard/transactions`) — history of top-ups and charges so you can reconcile your balance.

The **credits strip** on the dashboard often shows **balance** and quick links to these pages.

---

## 11. Signing out and security

- Use **Sign out** / logout in the header or account menu when you finish on a shared computer.
- You can manage **active sessions** where the product exposes that option (e.g. signing out other devices).

---

## 12. If something goes wrong

- **Login fails** — Check last name and ID, wait for a new OTP if the old one expired, and try another channel (email vs SMS) if offered.
- **“Insufficient credits”** — Check **Pricing**, then **Top up** or ask your registry how to add credits.
- **Wrong list after opening the site** — Refresh the page or open **Items** again from the sidebar; lists load from the server when you open each section.

For account or data issues that the app cannot solve, use the **support channel** your organization provides (email, desk, or phone).

---

## 13. Glossary (quick)

| Term | Meaning |
|------|--------|
| **Active item** | Currently in your main registered list. |
| **Stolen** | Reported as stolen; may open or link to a police case depending on setup. |
| **Deleted (soft)** | Removed from the active list but may be restored from **Deleted Items**. |
| **Legacy** | Set aside for reference; can often be restored to active. |
| **Credits** | Balance spent on certain paid actions. |
| **OTP** | One-time passcode for login or verification. |

---

*Document version: 1.0 — ordinary user scope. Align section numbers if you add role-specific manuals later.*
