# TeamTasks — Project Context

This file is a handoff document summarizing everything built and decided in the
Claude chat sessions that created this app, so that Claude Code (or any
developer) can pick up the project with full context.

- **Live app:** https://teamtasks-omega.vercel.app
- **GitHub repo:** https://github.com/keshavsdf-create/teamtasks (branch: `main`)
- **Owner:** keshavsdf-create, manager of a 5–10 person team, no coding background
- **Deployment:** Vercel, auto-deploys on every push to `main`
- **Stack:** Single-file static site (`public/index.html` — vanilla JS/HTML/CSS,
  no build step, no framework), backed by Supabase (Postgres) for data.

## What the app is

A Trello-style Kanban task manager for a small team, with a manager role and
employee roles, task approvals, voice notes/attachments, and an "Achievements"
archive. Brand: white duck mascot in a suit ("TeamTalk" logo), tagline
"Organize. Execute. Succeed." Design language: soft blue glassmorphism,
Inter font, teal/blue accents.

## Where everything lives

- All app code is in **one file**: `public/index.html` (~2700 lines: CSS in
  `<style>`, all JS in one `<script>` at the bottom, HTML templates rendered
  via `innerHTML` strings).
- `public/assets/` — logo, favicon, background images.
- No backend server — the Supabase JS SDK (loaded via CDN) is called directly
  from the browser using the **anon/publishable key** (client-side, by design;
  this is an internal team tool, not a public product).

## Supabase

- Project URL: `https://yptdkjryrpfmfouejmop.supabase.co`
- Project ref: `yptdkjryrpfmfouejmop`
- Anon/publishable key (already embedded in `index.html`):
  `sb_publishable_ymPQMeSYZtv0_RzB843fYQ_kFRsa5cV`
- Tables (all `uuid` primary keys, `users.id`/`public` tables keyed 1:1 with
  `auth.users.id` where relevant):
  - `users` — id (= `auth.users.id`), email, name, role, photo, created_at.
    **No password column** — Supabase Auth (`auth.users.encrypted_password`)
    owns credentials now; nothing in the app reads/writes a password on this
    table.
  - `tasks` — id, title, description, status, assigned_to, created_by,
    deadline, urgency, tags (jsonb), approval_status, links (jsonb),
    voice_notes (jsonb), attachments (jsonb), code, created_at, updated_at
  - `achievements` — id, task_id, user_id (holds the **assignee's name**, not
    an FK), title, description, urgency, completed_at
  - `messages` — id, sender_name, sender_role, text, created_at (team chat)
  - `app_settings` — single row (id=1), hidden_columns (jsonb) — which board
    columns a manager has hidden for everyone
- A Supabase MCP connector is available and has been reliably usable in
  later sessions (the earlier "No approval received" issue mentioned in an
  older version of this doc did not recur) — use it directly rather than
  assuming it's unavailable.

## Auth model — real Supabase Auth (migrated from a client-side-only scheme)

The app originally checked a plaintext password against a hardcoded/merged
`employees` array entirely in the browser, with "session" being just a
username string in `localStorage` and no server-side check at all — anyone
could `localStorage.setItem('teamtasks_session','manager')` and become
Manager. This was replaced with real authentication:

- **Login** (`handleLoginSubmit`) calls `supabase.auth.signInWithPassword()`.
  The "User ID" field the UI shows is not a raw username in Auth's eyes —
  it's mapped to a real email as `username + '@teamtasks.com'` (e.g. `manager`
  → `manager@teamtasks.com`), so the login form itself never had to change.
- **Session** (`checkSession`) is restored via `supabase.auth.getSession()` —
  a real signed JWT managed by supabase-js (persisted in its own
  `localStorage` keys, auto-refreshed), not anything the app manages itself.
  `handleLogout` calls `supabase.auth.signOut()`.
- Every person who can log in — including the four people who used to be a
  hardcoded fallback list (`manager`, `john`, `sarah`, `alex`, historically
  password `1234` each) — is now a real row in `auth.users` with a bcrypt
  password hash, created via direct SQL using `pgcrypto`'s
  `crypt(password, gen_salt('bf'))` (see migration `migrate_existing_users_to_auth`
  / `create_auth_for_fallback_accounts` in the project's migration history)
  and a matching `public.users` profile row sharing the same `id`. There is
  **no more hardcoded fallback `employees` array** in the client at all.
- **Employee management** (create / edit profile / delete) can't be done
  from the browser directly — creating or deleting a Supabase Auth user, or
  changing someone else's password, needs the **service-role key**, which
  must never reach client JS. Instead, `addEmployee()` / `saveEmployeeProfile()`
  / `deleteEmployeeProfile()` call a Supabase **Edge Function**,
  `manage-employee` (source in `supabase/functions/manage-employee/index.ts`,
  also deployed to the project). It verifies the caller's JWT, confirms
  they're a Manager (via `public.users.role`, looked up with the
  service-role client so it isn't gated by the caller's own RLS), and only
  then performs the privileged Auth-admin operation.
- **RLS** requires a real authenticated session (`auth.uid() is not null`)
  to read or write *anything* — the previous `USING (true)` / anyone-with-
  the-anon-key policy is gone. A `public.is_manager()` `security definer`
  helper (checks `public.users.role` for `auth.uid()`) additionally gates
  the specific actions that were already manager-only in the UI —
  deleting/restoring achievements, and updating `app_settings`
  (hidden columns) — **at the database level too**, not just client-side.
  `users` table: any authenticated user can `select` (needed for the team
  list / assign dropdowns), but there is no client-writable policy on it at
  all — writes only happen via the edge function's service-role client,
  which bypasses RLS entirely.
- What's still *not* covered by this: full per-row task visibility is still
  a client-render concern (`visibleTasks()`/`visibleApprovalTasks()`), not
  enforced by RLS — any authenticated user can read/write the `tasks` table
  broadly. Also, people are still referenced by mutable display **name**
  across tasks/achievements/chat (`assigned`, `createdBy`, `tagged`,
  achievement `assignedTo`, chat `sender_name`), not by the now-available
  stable `auth.uid()` — renaming someone can still silently disconnect their
  history in those places. Both are known, deliberately out-of-scope follow-ups.

## Features implemented

- **Kanban board** with columns: To Do, In Progress, Approval, Done, Need
  Help, Hold, Future, and a special shrunk "✨ Achievements" tab.
- **Drag and drop** between columns (native HTML5 drag/drop, task ids are
  passed via `dataTransfer` — see "Known sharp edges" below for the bug
  history here).
- **Approval workflow**: tasks in the Approval column show a color-coded
  section (yellow=pending, green=approved, red=rejected) and are **not
  draggable** — status changes only via Approve/Reject/Reset buttons.
- **Roles**: Manager sees/edits everything and manages employees. Employees
  see only tasks assigned to them or tasks they're tagged on (read-only for
  tagged tasks), and can only assign new tasks to themselves.
- **Employee management**: Manager can add/edit/delete employees via a "Your
  Team" dropdown; each employee has a profile modal with a task
  breakdown and per-employee dashboard.
- **Voice notes** (2 slots per task, browser `MediaRecorder`) and **file
  attachments** (up to 4 per task).
- **Achievements**: dragging a card onto the Achievements tab removes it from
  the board and archives it (saved to both `localStorage` as a fallback and
  Supabase's `achievements` table; the task's row is also deleted from the
  `tasks` table so it doesn't reappear on reload). Achievements are
  **employee-specific**: the assignee's name is tagged at archive time.
  Employees see only their own archived tasks; managers see everyone's,
  grouped by employee with a count badge.
- Cache-busting headers were added to `index.html` (`Cache-Control:
  no-cache, no-store, must-revalidate`, etc.) so shared links always serve
  the latest deployed version.

## Known sharp edges / patterns to watch for

These are recurring bug classes that came up repeatedly during development —
worth knowing about before making further changes:

1. **Never interpolate an id directly into an inline `onclick="..."` HTML
   string without quoting it.** Task/employee ids are Supabase UUIDs
   (contain hyphens), so `onclick="fn(${id})"` produces invalid JavaScript
   and silently fails on click with no visible error unless the console is
   open. Always use `onclick="fn('${id}')"` and compare ids with
   `String(a) === String(b)` on the receiving end, since some ids in memory
   may still be plain numbers (older/local-only data) rather than UUID
   strings.
2. **Every place that removes a task from local state must also delete (or
   otherwise reconcile) the corresponding row in Supabase's `tasks` table.**
   Just clearing the local `tasks` array is not enough — the old row's
   `status` will still match the "not achievement" filter used on load,
   so the task can silently reappear after a refresh. This bit both the
   achievement-archive flow and manual task deletion at different points.
3. (Historical — no longer applicable) `employees` used to be a merge of a
   hardcoded fallback list and Supabase rows, and replacing it wholesale
   could lock the manager out. There's no more fallback list — every account
   is a real Supabase Auth user now, so `loadEmployees()` just does a plain
   `select('*')` on `users`, which RLS already scopes to "must be logged in."
4. **`init()` must only be called after login, never blocking the login
   screen itself** — it was originally called on page load, which meant a
   slow/unreachable Supabase would leave the login form stuck. It now runs
   inside `showApp()`, after credential check succeeds.
5. The real page-load entry point (bottom of the `<script>` block) had at
   one point been left calling a function (`renderDashboard()`) that didn't
   exist anywhere in the file — a leftover from an earlier edit. This
   silently broke on every load and disabled "Remember Me"/auto-login
   entirely, with no visible symptom other than employees needing to log in
   every time. Worth being paranoid about this class of bug (a call to a
   function that was renamed/removed elsewhere) after any large refactor —
   grep for the call site and confirm the function still exists.
6. `persist()` currently does a full read-then-write loop over **every**
   task on every save (not just the changed one) — functionally fine for a
   5–10 person team's task volume, but is an N+1 pattern that would need
   revisiting if the task count grows much larger.

## Suggested next steps (not yet done)

- Per-row task/message visibility enforced by RLS (currently client-render
  only — any authenticated user can read/write the `tasks` and `messages`
  tables broadly).
- Move task/achievement/chat ownership from mutable display-name strings to
  the now-available stable `auth.uid()`, so renaming someone doesn't
  disconnect their history.
- Supabase Auth's "leaked password protection" (checks against
  HaveIBeenPwned) is currently off — worth turning on once everyone has
  moved off placeholder passwords like `1234`, since turning it on earlier
  would immediately reject logins using a known-breached password.
- The single-file architecture (~3300 lines in one HTML file) works but is
  getting large; if further significant features are added, splitting into
  separate JS modules would make it easier to maintain — Claude Code is a
  good fit for that kind of refactor.
