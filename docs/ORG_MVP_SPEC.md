# Organization (Org) MVP spec (iRegistry)

This document defines how **organization** (corporate) accounts work in iRegistry. We will refer to it throughout implementation.

**UI wording rule:** do **not** use the label “Org” in the UI. Prefer **“Organization”** or **“Company”** (pick one and stay consistent in UX copy). We may still use `org_*` internally in schema/code.

## Goals

- Support **Org-owned items** managed by multiple users.
- Support **users belonging to multiple Orgs**.
- Ensure **billing** for Org-owned item actions is taken from the **Org wallet**.
- Enforce **role-based permissions** for Org item actions.
- Keep the model clean: **don’t dump information where it doesn’t belong**. If existing tables don’t fit, create new flexible ones.

## Terminology

- **Personal item**: an item owned by an individual user (not owned by an Org).
- **Org item**: an item owned by an Org.
- **Assignment**: linking an Org item to a member user for day-to-day responsibility and visibility.
- **Org roles** (separate from platform/system roles like admin/cashier/police):
  - **Org Admin**
  - **Org Manager**
  - **Org Member**
- **App admin**: platform `admin` (system role), used for special actions across users/Orgs.

## Data model (conceptual)

### Orgs & membership

- **Org**
  - `id`, `name`, optional identifiers/contacts, timestamps
- **Org membership**
  - `org_id`, `user_id`, `org_role`, `status` (`INVITED|ACTIVE|REJECTED|REMOVED`), timestamps
  - Users may have **multiple memberships**.

### Items

- An item is either:
  - **Personal**: owned by a user, or
  - **Org-owned**: owned by an Org.
- Org items may be **unassigned** or **assigned** to a member.

### Wallets & billing

- **Org wallet**: credit balance and ledger entries for Org billing.
- Personal wallets remain for personal items (existing behavior).
- Billing decision:
  - If acting on an **Org-owned item**, charge **Org wallet**.
  - If acting on a **personal item**, charge **user wallet** (existing rules).

### Activity logging

- Log “where possible” for Org actions.
- If existing activity/audit tables “choke” (schema mismatch, scale, or semantics), create a dedicated:
  - **Org item activity log** (flexible `metadata` JSON), keyed by `org_id`, `item_id`, `actor_user_id`, `action`, timestamp.

## UI principles

- Do **not** label this feature “Org” in the UI. Use **“Organization”** or **“Company”**.
- Members must not see other Org items unless they are assigned to them.
- Assigned Org items shown in personal lists must be **flagged** and show the **Organization/Company name**, with **limited actions**.
- Support **bulk assign** / **bulk unassign** for managers/admins.

## Permissions (Org-owned items)

### Visibility

- **Org Member**
  - Can see **personal items** they own
  - Can see **only Org items assigned to them**
  - Must **not** see other Org items (including unassigned)
- **Org Manager / Org Admin**
  - Can see **all Org items** in that Org (assigned + unassigned)

### Actions

| Action | Org Member | Org Manager | Org Admin |
|---|---:|---:|---:|
| View Org item | Assigned only | Yes | Yes |
| Add Org item | No | Yes | Yes |
| Edit Org item | No | Yes | Yes |
| Delete Org item | No | No | **Yes** |
| Transfer Org item | No | No | **Yes** |
| Assign / repeal assignment | No | **Yes** | **Yes** |
| Bulk assign / bulk unassign | No | **Yes** | **Yes** |
| Declare stolen | **Assigned only** | Yes | Yes |
| Mark active again (resolve stolen) | No | **Yes** | **Yes** |
| Mark legacy | No | **Yes** | **Yes** |
| Restore from legacy | No | No | **Yes** |

Notes:
- Once an item is declared stolen, only **Org Manager** and **Org Admin** may mark it active again.
- Only **Org Admin** can delete or transfer items.

## Invitations & membership flows

- **Invite**: Org Admin (and optionally Org Manager later) can invite a user to join an Org.
- **Accept**: user accepts invite → membership becomes `ACTIVE`.
- **Reject**: user can reject invite → membership becomes `REJECTED` (audited).
- Removing a member (`REMOVED`) should unassign their items (or move to unassigned queue).

## Return request flow (member → manager/admin)

- A member can **request to return** an assigned Org item.
- Return request states:
  - `OPEN` → `APPROVED` (item becomes unassigned) or `REJECTED`
- Who can act:
  - Member: create request (for assigned items only), cancel request (optional)
  - Manager/Admin: approve/reject with note (audited)

## Transfers between personal and Org (App admin)

App admin can transfer items:

- **Personal → Org**
- **Org → Personal**

Requirements:
- Must capture **reason** and optional **evidence** (attachment reference or structured metadata).
- Must be logged (audit + Org item activity when relevant).
- Should be implemented as a dedicated server-side operation (transactional).

## Bulk assign capability

- Managers/Admins can select multiple items and assign to a member (or unassign).
- Must validate:
  - All items belong to the Org
  - Target user is an **ACTIVE member** of that Org
- Must log:
  - One “bulk” activity entry + per-item entries (or per-item only, depending on volume)

## Implementation guidance (non-negotiables)

- Prefer **clear domain tables** over overloading existing ones with unrelated semantics.
- If anything “chokes” (query complexity, constraints, missing fields), create a new flexible table rather than forcing data into the wrong place.
- Keep authorization server-side:
  - Determine Org and permissions based on item’s ownership + membership.

