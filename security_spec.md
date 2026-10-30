# TabFlow Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants

1. **Default-Deny Catch-All**: All paths not explicitly matched (`/users/{userId}`, `/folders/{folderId}`, `/links/{linkId}`) are unconditionally denied (`allow read, write: if false`).
2. **Authorized Identity Invariant**: Every write operation (`create`, `update`, `delete`) requires `request.auth != null && (request.auth.token.email_verified == true || request.auth.token.firebase.sign_in_provider == 'anonymous')`.
3. **Path Variable Hardening**: Every single-document target (`get`, `create`, `update`, `delete`) validates the path document ID with `isValidId(id)` (`id is string && id.size() >= 1 && id.size() <= 128 && id.matches('^[a-zA-Z0-9_\\-]+$')`).
4. **Strict Ownership Invariant**:
   - A `UserProfile` document at `/users/{userId}` can only be read (`get`), created, or updated by `request.auth.uid == userId`, with `(resource == null || existing().uid == request.auth.uid)` on `get` and `incoming().uid == userId` on writes. No `list` operation is allowed on `/users`.
   - A `Folder` document at `/folders/{folderId}` must have `user_id == request.auth.uid` on creation and `existing().user_id == request.auth.uid` on read/update/delete, with `incoming().id == folderId`.
   - A `LinkItem` document at `/links/{linkId}` must have `user_id == request.auth.uid` on creation and `existing().user_id == request.auth.uid` on read/update/delete, with `incoming().id == linkId`.
5. **Relational Parent Invariant**: A `LinkItem` cannot be created or moved unless its referenced `folder_id` exists at `/folders/$(incoming().folder_id)` AND belongs to `request.auth.uid` (`get(...).data.user_id == request.auth.uid`).
6. **Temporal & Immutability Invariant**:
   - On `create`: `incoming().createdAt == request.time && incoming().updatedAt == request.time`.
   - On `update`: `incoming().createdAt == existing().createdAt && incoming().updatedAt == request.time`, and immutable identity fields (`id`, `user_id`, `uid`) cannot change.
7. **Action-Based Updates & Strict Keys**:
   - Every `create` checks `data.keys().hasAll(...) && data.keys().hasOnly(...)`.
   - Every `update` wraps logic with `isValid[Entity](incoming())` and partitions allowed mutations into explicit Action branches using `incoming().diff(existing()).affectedKeys().hasOnly(...)`.
8. **Query Enforcer Invariant**: `allow list` on `/folders` and `/links` strictly requires `isSignedIn() && resource.data.user_id == request.auth.uid` (no blanket `isSignedIn()` list reads and no `get()` inside `list`).

## 2. The "Dirty Dozen" Payloads

1. **Payload 1 (Unverified Email Write)**: Authenticated user with `email_verified: false` attempts to create a `Folder`. -> `PERMISSION_DENIED`
2. **Payload 2 (Identity Spoofing on Folder Create)**: User `uid-A` sends a `Folder` create payload with `user_id: "uid-B"`. -> `PERMISSION_DENIED`
3. **Payload 3 (Shadow Field Injection on Folder Create)**: User `uid-A` sends a valid `Folder` payload plus `"isAdmin": true`. -> `PERMISSION_DENIED`
4. **Payload 4 (Orphaned Link Creation)**: User `uid-A` creates a `LinkItem` referencing a non-existent `folder_id: "fld-missing"`. -> `PERMISSION_DENIED`
5. **Payload 5 (Cross-Tenant Link Injection)**: User `uid-A` creates a `LinkItem` referencing `folder_id: "fld-owned-by-B"` belonging to `uid-B`. -> `PERMISSION_DENIED`
6. **Payload 6 (Update-Gap / Value Poisoning on Folder Update)**: User `uid-A` updates `name` on their `Folder` with a 5,000-character string or integer `12345`. -> `PERMISSION_DENIED`
7. **Payload 7 (Immutable Field Tampering on Update)**: User `uid-A` updates `createdAt` or `user_id` on an existing `Folder`. -> `PERMISSION_DENIED`
8. **Payload 8 (Forged Client Timestamp)**: User `uid-A` sends a past/future timestamp instead of `request.time` for `updatedAt`. -> `PERMISSION_DENIED`
9. **Payload 9 (ID Poisoning / Path Mismatch)**: User `uid-A` creates `/folders/fld-1` where `incoming().id == "fld-2"` or uses invalid characters `fld$bad!`. -> `PERMISSION_DENIED`
10. **Payload 10 (Unauthorized Cross-User Read/List)**: User `uid-A` attempts to `list` `/folders` without filtering by `user_id == "uid-A"` or `get` `/folders/fld-owned-by-B`. -> `PERMISSION_DENIED`
11. **Payload 11 (Cross-User Profile Read / PII Probe)**: User `uid-A` attempts to `get` `/users/uid-B` or `list` `/users`. -> `PERMISSION_DENIED`
12. **Payload 12 (Invalid Enum Color / Status)**: User `uid-A` attempts to set `Folder.color = "neon-pink"` or `LinkItem.status = "HACKED"`. -> `PERMISSION_DENIED`
