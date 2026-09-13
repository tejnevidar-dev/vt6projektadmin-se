# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **bun** (`bun.lockb` is the real lockfile; ignore the `npm i` in the
generated README — it's stale from the Lovable template).

```bash
bun install --frozen-lockfile   # install deps (what CI uses)
bun run dev                     # dev server (vite dev)
bun run build                   # production build
bun run build:dev                # dev-mode build (used by CI to smoke-test the build)
bun run lint                     # eslint .

bun run test                     # vitest run (all unit tests)
bun run test:watch               # vitest watch mode
bunx vitest run src/test/role-routing.test.ts   # single unit test file

bun run test:e2e                 # playwright test (headless)
bun run test:e2e:ui              # playwright with UI
bunx playwright test e2e/login-flow.spec.ts     # single e2e spec

bun run scripts/test-pdf-pipeline.ts   # standalone PDF pipeline check (test:pdf script)
```

CI (`.github/workflows/ci.yml`) runs unit tests + `build:dev` on every push, and a
separate Playwright job with Supabase env vars sourced from GitHub Actions repo
variables (falls back to a fake `example.supabase.co` project if those aren't set).

## Architecture

**Stack:** TanStack Start (file-based routing, React 19) + Vite + Tailwind 4 + Radix UI,
Supabase (Postgres + RLS + Storage + Auth) as the only backend, Cloudflare Workers as the
configured build target (`wrangler.jsonc`, via `@cloudflare/vite-plugin`) though
production currently actually runs on Lovable Cloud/Lovable's hosting — see
`docs/lovable-exit-plan.md` for the in-progress migration off Lovable and why
`lovable.dev` URLs/packages still appear throughout the codebase.

`vite.config.ts` is hand-written (as of 2026-09-08, replacing the removed
`@lovable.dev/vite-tanstack-config`): TanStack Start plugin, `@tanstack/devtools-vite`
(dev only), `@vitejs/plugin-react`, the Tailwind plugin, `vite-tsconfig-paths`, and
Nitro (`nitro/vite`, `cloudflare-module` preset — this is what actually targets
Cloudflare Workers on build, not the unused `@cloudflare/vite-plugin` still sitting in
`package.json`). See `docs/lovable-exit-plan.md` §1.2 for what was intentionally left
out (it was all Lovable-sandbox-only behavior, dead code outside Lovable anyway).

### Authorization lives in Postgres, not in application code

This is the most important thing to internalize before changing anything permission-related.
There is no app-level authorization/guard layer — almost every access rule is a Postgres
RLS policy in `supabase/migrations/*.sql` (raw SQL, no ORM, no query builder — files apply
in filename-timestamp order). Roles are the `app_role` enum (`admin`, `saljare`, `ekonomi`,
`arbetsledare`, `hantverkare`, `underentreprenor`, `viewer`), stored in `user_roles` and
checked via `private.has_role(user_id, role)` — a `SECURITY DEFINER` function that lives in
the `private` schema specifically so `EXECUTE` can stay revoked from `anon`/unprivileged
`authenticated` callers. Always use `private.has_role`, not `public.has_role` — the
`public` version is a dead first draft, superseded and revoked early in the migration
history but never deleted.

Changing what a role can do means writing a new migration (`DROP POLICY` /
`CREATE POLICY`, or a `BEFORE`-trigger for anything RLS can't express, like restricting
which *columns* a role may update), not editing TypeScript. `supabase/config.toml`'s
`project_id` and the app's `SUPABASE_*` env vars must always point at the same project as
whatever migrations you're reasoning about.

### Backend access patterns in `src/`

Three distinct ways the app talks to Supabase — know which one a file uses before editing it:

- **`src/lib/*-api.ts`** — direct client-side Supabase calls (the browser's own session,
  RLS enforced as the logged-in user). Most CRUD lives here.
- **`src/lib/*.functions.ts`** and `src/routes/api/**` — TanStack Start server functions
  (`createServerFn`). Most wrap the `requireSupabaseAuth` middleware
  (`src/integrations/supabase/auth-middleware.ts`), which builds a request-scoped Supabase
  client that forwards the caller's own Bearer token — so RLS still applies as that user,
  it's just running server-side (e.g. to call an external API with a secret key first).
- **`src/lib/*.server.ts`** and `src/integrations/supabase/client.server.ts`
  (`supabaseAdmin`) — server-only code that can use the Supabase **service role** and
  fully bypass RLS, plus other server secrets (AI, email, Twilio, SEMrush, GSC). Never
  import `client.server.ts` from anything that reaches the browser bundle.

### Domain model: Lead → Offer → Job → ÄTA

- **`leads`** — the pipeline entity. `pipeline_stage` drives most of the top-level routes
  (`bokade.tsx`, `pagaende.tsx`, `slutforda.tsx`, `offerterade.tsx`, `forhandling.tsx`,
  `uppfoljning.tsx` each correspond to a stage). `seller_id` is commission attribution
  only, not an access-control boundary — salespeople intentionally see/edit every lead
  (a shared-pool team model), not just their own.
- **`offers`** — versioned offer history per lead (`UNIQUE(lead_id, version)`), own
  `offer_status` lifecycle (draft/skickad/accepterad/avvisad).
- **`jobs`** — auto-created by a trigger (`handle_lead_booking`) when a lead's
  `pipeline_stage` becomes `'bokad'` and `assigned_to` is set to an `arbetsledare`/
  `underentreprenor`. 1:1 with a lead (`UNIQUE(lead_id)`) today. Has its **own** status
  enum, `job_status` (`ej_paborjad`/`pagaende`/`klar`) — do not confuse this with
  `leads.pipeline_stage`, which happens to also have a value called `pagaende`; they are
  unrelated enum types on unrelated tables.
- **`atas`** (ÄTA = ändrings-/tilläggsarbete) — job-scoped change-order records, own
  sequential per-job numbering (`reserve_ata_number()`, formatted `'ÄTA-001'`, mirrors the
  older per-year `reserve_offer_number()` pattern). Has its own approval workflow
  (`approval_status`), gated by an admin-editable threshold in `app_settings`
  (key `ata_approval_threshold`) rather than a hardcoded number, specifically so the
  threshold can change without a new migration.
- **`signature_requests`** — the generic e-signature transport used for offers,
  contracts, and ÄTA alike. It is **not** the business record itself; `document_type`
  and (for ÄTA) `ata_id` link a signing request back to the real entity. Historically
  this table had no `document_type` at all — expect `NULL` on rows created before that
  column existed, and treat `NULL` as "legacy", not as a bug.
- `leads.offer_accepted_at` and `offers.status = 'accepterad'`/`offers.accepted_at` are
  two **independently maintained** signals for "the offer was accepted" — nothing in the
  database keeps them in sync (they're set by different code paths in
  `src/lib/leads-api.ts` and `src/lib/calculations-api.ts` respectively). Don't assume
  one implies the other.

### Routing

File-based routes in `src/routes/` compile into `src/routeTree.gen.ts` — that file is
auto-generated by the TanStack Router plugin; never hand-edit it, just add/rename files
under `src/routes/` and rebuild.

### Testing

Vitest unit tests live in `src/test/`; Playwright specs in `e2e/`. Given how much
authorization is RLS/role-based rather than UI-based, role-gating gets tested explicitly
(`src/test/role-routing.test.ts`, `e2e/role-matrix.spec.ts`, `e2e/login-flow.spec.ts`,
`e2e/logout-flow.spec.ts`) — when changing a role's permissions, check whether these need
updating too, not just the RLS policy itself.
