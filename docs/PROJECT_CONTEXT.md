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
- Tables (all `uuid` primary keys via `gen_random_uuid()`):
  - `users` — id, email, name, role, password, created_at
  - `tasks` — id, title, description, status, assigned_to, created_by,
    deadline, urgency, tags (jsonb), approval_status, code, created_at, updated_at
  - `achievements` — id, task_id, user_id (holds the **assignee's name**, not
    an FK), completed_at
- RLS is **enabled** on all three tables with a permissive policy
  (`FOR ALL USING (true) WITH CHECK (true)`) so the anon key can read/write.
  This is intentionally wide-open — acceptable for an internal tool behind a
  not-publicly-shared URL, but **not** safe if this app is ever exposed
  more broadly. Tightening RLS is a natural next step if that changes.
- IMPORTANT caveat: the assistant that set this up **does not have a
  reliable way to independently verify live Supabase state** (table
  contents, RLS status, advisors) from this chat environment — a Supabase
  MCP connector exists but tool calls have failed with "No approval
  received" every time they were tried. If something looks like a data
  problem, check the Supabase dashboard directly (SQL Editor, Table Editor)
  rather than assuming the assistant already confirmed it there.

## Auth model (intentionally simple — no real auth provider)

- Login is ID + a plain password, checked client-side against the in-memory
  `employees` array (which merges Supabase `users` rows with a hardcoded
  fallback list). This is **not secure** in any real sense (passwords are
  plaintext, checked client-side) — appropriate only because this is a small
  trusted internal team, not a public product.
- Hardcoded fallback accounts (always available even if Supabase is down):
  `manager`/`1234`, `john`/`1234`, `sarah`/`1234`, `alex`/`1234`.
- On load, `init()` merges Supabase-loaded employees with this fallback list
  (Supabase entries win on username collision, but fallback-only entries are
  never dropped) — this was a deliberate fix so the manager account can never
  get locked out even if Supabase only has partial/odd data in it.
- Login itself never blocks on Supabase: the fallback list is available
  synchronously, and `init()` (which loads real data) only runs **after** a
  successful login, inside `showApp()`.

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
3. **Any code that replaces `employees` wholesale from a Supabase query
   result is dangerous** — if Supabase only has partial data (e.g. one
   manually-added employee), a full replace can wipe out the manager
   account and lock everyone out. Always merge (Supabase wins on username
   collision, fallback entries not present in Supabase are kept) rather
   than replace.
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

- Verify live Supabase state (tables/RLS/advisors) directly, since the
  assistant could not do this from chat — worth doing once via the Supabase
  dashboard or a properly-authorized MCP session.
- Consider whether RLS policies should be tightened before this app is
  shared more widely than the current small team.
- The single-file architecture (~2700 lines in one HTML file) works but is
  getting large; if further significant features are added, splitting into
  separate JS modules would make it easier to maintain — Claude Code is a
  good fit for that kind of refactor.
