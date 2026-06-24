@AGENTS.md

# Project: CS Executive Group Portal

Next.js 16 (App Router) + TypeScript + Supabase + Tailwind CSS v4. Multi-module portal (regulatory, recruitment, CRM). The regulatory module is the primary active area.

## Tech Stack

- **Framework**: Next.js 16 App Router — read `node_modules/next/dist/docs/` before writing any Next.js code
- **Database**: Supabase (`@supabase/ssr` v0.12) — regulatory data lives in the `regulatory` schema
- **UI**: Tailwind CSS v4, shadcn/ui components (`src/components/ui/`), lucide-react icons
- **Forms**: react-hook-form + zod v4
- **File parsing**: xlsx (Excel), custom parsers in `src/lib/import/`

## Project Structure

```
src/
  app/
    (portal)/
      regulatory/
        chemicals/          # Chemical search + detail pages
        consultations/      # Consultation list, detail, new wizard
          [consultationId]/
            page.tsx        # Tabs: Chemicals, Volumes, Logs, Upload
            ChemicalsTab.tsx
            VolumesTab.tsx
            LogsTab.tsx
            UploadFormulationDialog.tsx
        companies/          # Companies list
        admin/              # Admin-only: users, companies, regulatory-lists, import
      home/ recruitment/ crm/  # Other modules (stubs)
    api/
      chemicals/            # GET list, [chemicalId]/regulatory GET
      consultations/        # GET list, POST create
        [consultationId]/
          route.ts          # GET, PATCH
          chemicals/        # GET, POST
          upload/           # POST (formulation upload)
          logs/             # GET
          products/         # GET
      companies/            # GET, POST, [companyId]/assignments
      users/                # GET, [userId]/consultations, [userId]/modules
      formulation/          # POST parse, /template GET
      import/               # POST (regulatory list import)
      admin/                # Admin-only API routes
    auth/callback/          # Supabase auth callback
  components/
    ui/                     # shadcn/ui primitives (button, input, dialog, etc.)
    layout/                 # Sidebar.tsx, PageHeader.tsx
    chemicals/              # RegulatoryStatusBadge.tsx
  lib/
    supabase/
      client.ts             # Browser Supabase client
      server.ts             # Server Supabase client (uses cookies())
      admin.ts              # Service-role client (bypasses RLS)
    chemicals/
      resolver.ts           # Chemical resolution logic
      pubchem.ts / echa.ts  # External API clients
      types.ts
    import/
      excel-parser.ts
      aicis-parser.ts
      column-mapper.ts
      import-pipeline.ts
      regulatory-list-pipeline.ts
      formulation-parser.ts
      formulation-pipeline.ts
    consultation-log.ts     # logConsultationEvent() helper
    auth-helpers.ts
    date-helpers.ts
    utils.ts                # cn() (clsx + tailwind-merge)
  types/
    database.ts             # All Supabase types (source of truth)
supabase/
  migrations/               # SQL migration files (timestamp-prefixed)
```

## Key Patterns

**Supabase access**
- Server components / API routes: `createClient()` from `@/lib/supabase/server`
- Client components: `createClient()` from `@/lib/supabase/client`
- Admin operations (bypass RLS): `createAdminClient()` from `@/lib/supabase/admin`
- Regulatory schema: `supabase.schema("regulatory").from("table_name")`

**API routes**
- Every route starts with auth check: `const { data: { user } } = await supabase.auth.getUser()`
- Return 401 if no user, 500 with `error.message` on DB errors
- POST requests validated with Zod before hitting the DB
- Pattern: `GET` = list/fetch, `POST` = create, `PATCH` = update

**Types** (`src/types/database.ts`)
- `ConsultationStatus`: `"draft" | "in_progress" | "under_review" | "completed" | "archived"`
- `RegulatoryFramework`: `"aicis" | "reach" | "tsca"`
- `RegulatoryStatus`: `"listed" | "not_listed" | "exempt" | "restricted" | "pending" | "unknown"`
- `Module`: `"regulatory" | "recruitment" | "crm"`
- `ModuleAccessLevel`: `"admin" | "member"`
- `Role`: `"super_admin" | "user"`
- `AliasType`: `"trade_name" | "synonym" | "iupac" | "cas_rn"`

**Path alias**: `@/` maps to `src/`

**Consultation logs**: use `logConsultationEvent()` from `@/lib/consultation-log` to record actions

**consultation_chemicals schema (critical)**
- Unique key: `UNIQUE(consultation_id, chemical_id, product_name)` — same chemical can appear once per product
- `product_name NOT NULL DEFAULT ''` — empty string means "no product assigned"
- `chemical_id` is nullable — NULL rows = unresolved ingredients (PostgreSQL treats NULLs as distinct in UNIQUE, so multiple unresolved rows per product are allowed)
- Upsert conflict key in formulation pipeline: `"consultation_id,chemical_id,product_name"`
- DELETE always by row `id` (UUID), never by `chemical_id` alone (same chemical may appear in multiple products)
- Deleting a product cascades to its `consultation_chemicals` rows via `DELETE WHERE consultation_id=X AND product_name=Y`

**VolumesTab / ChemicalsTab refresh**
- ChemicalsTab owns its own `chemicals` state; refreshes via `GET /api/consultations/[id]/chemicals`
- After any upload/delete, call `router.refresh()` (from `next/navigation`) to revalidate server component props and update VolumesTab's `chemicals` prop

**`match_chemicals_by_names` RPC** (`supabase/migrations/20260624000002_fix_name_lookup_rpc.sql`)
- Searches `chemical_aliases` first (exact case-insensitive), then unions `chemicals.common_name` as fallback
- AICIS-imported chemicals and CAS-matched uploads never write alias rows, so the fallback is essential for name-only lookups (no CAS provided)

**Product delete cascade**
- `DELETE /api/consultations/[id]/products?product_name=X` removes from both `consultation_products` (units_per_year, unit_size_grams) AND `consultation_chemicals` (all ingredient rows for that product)
- Chemicals shared with other products are untouched — they have different `product_name` rows

**Dashboard live updates**
- `OngoingConsultations` client component polls `GET /api/consultations?status=in_progress,under_review` every 30 seconds
- `GET /api/consultations` accepts `?status=` (comma-separated) and `?company_id=` filters; sorted by `due_date ASC`
- Stat cards show pipeline breakdown (Draft / Active / Completed) — not a single "Total" which includes all statuses

**Admin users page**
- Non-super-admin module admins do NOT see `super_admin` accounts in the user list
- `isSuperAdmin` guard filters the `users` array before rendering

**Consultation status**
- `ConsultationStatusControl` client component in consultation detail header; calls `PATCH /api/consultations/[id]` on select change
- PATCH handler auto-sets `completed_at` when status moves to `"completed"`

**ChemicalsTab manual add**
- `products: string[]` prop passed from page.tsx; shown as a dropdown in the add form when products exist
- POST to `/api/consultations/[id]/chemicals` accepts `product_name`; auto-creates stub row in `consultation_products` if product_name is non-empty

## Commands

```bash
npm run dev      # Start dev server (Turbopack)
npm run build    # Production build
npm run lint     # ESLint
```

