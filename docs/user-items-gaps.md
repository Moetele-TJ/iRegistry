# Gaps worth prioritizing (user / items lens)

Tick items as you complete them (`[ ]` → `[x]`).

## 1. Self-serve credits

- [ ] **1.1** Define payment channel(s) for end users (e.g. mobile money, card).
- [ ] **1.2** Implement server path: initiate payment → verify webhook/callback → grant credits (same invariants as cashier top-up).
- [ ] **1.3** User UI: “Buy credits” flow + confirmation + error states.
- [ ] **1.4** Ensure new credits appear in **Transactions** and balance updates without refresh (or with explicit refresh).

## 2. Paid actions & balance UX

- [x] **2.1** Audit all credit-consuming flows; each shows **cost** before confirm.
- [x] **2.2** Each shows **current balance** (or clear “insufficient credits” with link to buy/top-up).
- [x] **2.3** Failed billing surfaces a **single, actionable** message (no silent failure).
- [x] **2.4** (Optional) Dashboard **Credits** strip: balance + link to pricing + last charge.

## 3. Item UX coherence

- [ ] **3.1** Decide: keep global `/items` routes vs add `/userdashboard/items/*` aliases — document the decision.
- [ ] **3.2** If keeping global routes: add **consistent “back to overview”** to `/userdashboard`.
- [ ] **3.3** **Report theft** quick action deep-links to the theft/stolen flow (not only `/items` list).

## 4. Trust, compliance, account lifecycle

- [ ] **4.1** Profile: **export my data** (or document manual process + SLA).
- [ ] **4.2** Profile: **delete account** (or documented support process + what gets removed).
- [ ] **4.3** In-app **Help / FAQ** + support contact.
- [ ] **4.4** Surface **verification status** (email/phone) if relevant to your auth model.

## 5. Reliability & operations

- [ ] **5.1** Add-item / photo upload: **retry** and user-visible recovery on transient failures.
- [ ] **5.2** Embedding (or other queues): **monitor failures** + admin visibility or alerts.
- [ ] **5.3** **Error tracking** on client (e.g. Sentry) + **structured logs**/alerts on edge functions.

## 6. Security & abuse

- [ ] **6.1** Confirm **rate limits** on hot paths (serial check, auth, public search, uploads).
- [ ] **6.2** Define **re-auth** or extra confirmation for high-risk actions (optional policy).

## 7. Quality bar

- [ ] **7.1** Automated tests for: login, add item, list items, transfer/credit path (as applicable).
- [ ] **7.2** Pass on **mobile + keyboard** for main user/item flows.
