# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Next.js Version Warning

This project runs **Next.js 16.2.9** with React 19 — a cutting-edge version that may differ significantly from training data. Before writing any Next.js-specific code, read the relevant guide in `node_modules/next/dist/docs/` and heed deprecation notices.

## Commands

```bash
bun dev          # start dev server
bun build        # production build
bun lint         # run ESLint

bun run db:generate   # generate Drizzle migration from schema changes
bun run db:migrate    # apply pending migrations to the DB
bun run db:push       # push schema directly (no migration file, dev-only)
bun run db:studio     # open Drizzle Studio (visual DB browser)

bun run auth:generate # regenerate db/auth-schema.ts from lib/auth.ts (run after Better Auth config changes)
```

No test suite exists yet.

## Environment Variables

Copy `.env.example` to `.env.local`. Required variables:

| Variable | Purpose |
|---|---|
| `DB_URL` | Neon Postgres connection string |
| `BETTER_AUTH_SECRET` | Session signing secret |
| `BETTER_AUTH_URL` | Public origin (e.g. `http://localhost:3000`) |
| `R2_ACCOUNT_ID` | Cloudflare account ID |
| `R2_ACCESS_KEY_ID` | R2 HMAC key ID |
| `R2_SECRET_ACCESS_KEY` | R2 HMAC secret |
| `R2_BUCKET` | R2 private bucket name |

## Architecture

### Data model

The family graph (people, couples, parent-child links, collapsed node IDs) is stored as a single **JSONB blob** in `trees.data`. Tree metadata that must be queried or authorised on lives in typed columns. Three satellite tables are derived from that blob and must never be the source of truth:

- `people_index` — rebuilt on every `saveTreeData` call; used for cross-tree search.
- `media_asset` — separate table so R2 uploads don't race with graph autosave.
- `tree_membership` — per-tree collaborator roles (`member | editor | owner`).

The tree settings (e.g. document visibility) live in `trees.settings` (a separate JSONB column) precisely so the graph autosave can overwrite `data` without clobbering them.

### Auth & permissions — two-layer model

**Global role** (`user.role`): `user` (default) or `super_admin`. Managed by Better Auth's admin plugin (`lib/auth.ts`). `super_admin` gets synthetic `owner` access to every tree.

**Per-tree role**: `member | editor | owner`. Owner is stored on `trees.ownerId`; collaborators are rows in `tree_membership`. Role resolution lives in `lib/tree-access.ts`:
- `requireTreeView` / `requireTreeEdit` / `requireTreeOwner` — server-side route guards that redirect on failure (call these in Server Components and Server Actions).
- `canViewTree` / `canEditTree` / `canManageTree` in `lib/permissions.ts` — rank-based helpers used in queries and access decisions.

Auth helpers for server components:
- `getSession()` — nullable session from `lib/auth-server.ts`
- `requireAuth()` — redirects to `/login` if not signed in
- `requireSuperAdmin()` — redirects to `/tree` if not super_admin

### Client-side state (Zustand)

`features/family-tree/hooks/useFamilyStore.ts` holds the in-memory tree graph. Every mutation goes through `patchActive()` which debounces (`800 ms`) a call to the `saveTreeData` Server Action. The store is hydrated once by a Server Component passing the DB row to `TreeView`, which calls `loadTree`.

### Canvas rendering

The tree is rendered with **@xyflow/react** (React Flow). The graph is built from the Zustand store by `features/family-tree/utils/layout.ts` which converts `{people, couples, parentChildren}` into React Flow nodes and edges. Node types: `person`, `couple`. Edge types: `spouse`, `parentChild`.

### Media (R2 uploads)

Uploads are two-step — never proxied through Next.js:
1. `requestUpload` (Server Action) — validates the request and mints a presigned **PUT** URL.
2. Browser uploads directly to R2.
3. `confirmUpload` (Server Action) — calls `HeadObject` to verify what actually landed (never trusts client-reported size/type), then writes the `media_asset` row.

Downloads are served as short-lived presigned **GET** URLs (300 s TTL) minted in `lib/r2.ts`. `lib/r2.ts` is marked `server-only`.

R2 key structure: `trees/<treeId>/members/<personId>/profile/<id>.<ext>`, `.../documents/<id>.<ext>`, `trees/<treeId>/gallery/<id>.<ext>`.

### Directory conventions

```
app/                 Next.js App Router pages (thin — delegate to features/)
features/family-tree/
  components/        React components (Flow/, dialogs/, media/, etc.)
  hooks/             Client hooks (useFamilyStore, useTreeAccess, useMediaUpload…)
  server/            Server Actions (actions.ts, media-actions.ts)
  types/             Shared TypeScript types (index.ts is the source of truth)
  utils/             Pure helpers (layout, relations, person, age, mockData)
db/                  Drizzle schema + connection (schema.ts re-exports auth + tree schemas)
lib/                 Server utilities: auth, auth-server, permissions, tree-access, r2
components/ui/       shadcn/ui primitives
```

### First-run bootstrap

The first user to sign up gets no special treatment from Better Auth. Promoting someone to `super_admin` must be done directly in the DB (`UPDATE "user" SET role = 'super_admin' WHERE email = '...'`).
