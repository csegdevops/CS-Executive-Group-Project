@AGENTS.md

# Project: CS Executive Group Portal

Next.js 16 (App Router) + TypeScript + Supabase + Tailwind CSS v4. Multi-module portal (regulatory, recruitment, CRM). The regulatory module is the primary active area.

## Tech Stack

- **Framework**: Next.js 16 App Router — read `node_modules/next/dist/docs/` before writing any Next.js code
- **Database**: Supabase (`@supabase/ssr` v0.12) — regulatory data in `regulatory` schema, recruitment ATS data in `recruitment` schema
- **UI**: Tailwind CSS v4, shadcn/ui components (`src/components/ui/`), lucide-react icons
- **Forms**: react-hook-form + zod v4
- **File parsing**: xlsx (Excel), custom parsers in `src/lib/import/` — xlsx is used in exactly 2 files (`src/lib/import/excel-parser.ts` for reading, `src/app/api/formulation/template/route.ts` for writing); all other import code consumes the parsed output. Note: xlsx has unpatched CVEs (no free fix); candidate for migration to `exceljs` (API-compatible rewrite, no visible behavior changes needed)

## Project Structure

```
src/
  app/
    (portal)/
      regulatory/
        chemicals/          # Chemical search + detail pages; CreateChemskillButton.tsx
        consultations/      # Consultation list, detail, new wizard
          [consultationId]/
            page.tsx        # Tabs: Details, Chemicals, Regulatory Status, Import Volumes, Timeline
            ChemicalsTab.tsx
            VolumesTab.tsx
            TimelineTab.tsx          # Combined checklist + logs timeline
            UploadFormulationDialog.tsx
            BackButton.tsx
            EditDetailsDialog.tsx    # PATCH title/description/due_date/frameworks/reference
            NotesSection.tsx         # Consultant notes (GET/POST/DELETE /notes)
            PushToDbDialog.tsx       # Push unresolved chemical to global DB as Chemskill
        companies/          # Companies list
        admin/              # Admin-only: users, companies, regulatory-lists, import
      home/ crm/          # Other modules (stubs)
      recruitment/        # Recruitment ATS module (UI routes pending — schema live)
    api/
      chemicals/            # GET list (+ POST create Chemskill chemical)
      consultations/        # GET list, POST create (auto-generates CS-YYYY-NNN reference)
        [consultationId]/
          route.ts          # GET, PATCH (audits field changes → consultation_logs)
          chemicals/        # GET, POST (resolve via PubChem → null if unknown), PATCH (resolve OR reassign product), DELETE
          upload/           # POST (formulation upload — DB lookup then PubChem fallback)
          logs/             # GET
          notes/            # GET, POST, DELETE (consultation_notes table)
          products/         # GET, POST (volumes), DELETE (cascades chemicals)
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
- Recruitment schema: `supabase.schema("recruitment").from("table_name")`

**API routes**
- Every route starts with auth check: `const { data: { user } } = await supabase.auth.getUser()`
- Return 401 if no user, 500 with `error.message` on DB errors
- POST requests validated with Zod before hitting the DB
- Pattern: `GET` = list/fetch, `POST` = create, `PATCH` = update
- **All DB writes in API routes use `createAdminClient()`** — user client is for auth only; RLS on regulatory tables blocks writes from the authenticated key

**Types** (`src/types/database.ts`)
- `ConsultationStatus`: `"draft" | "in_progress" | "under_review" | "completed" | "archived"`
- `RegulatoryFramework`: `"aicis" | "reach" | "tsca"`
- `RegulatoryStatus`: `"listed" | "not_listed" | "exempt" | "restricted" | "pending" | "unknown"`
- `Module`: `"regulatory" | "recruitment" | "crm"`
- `ModuleAccessLevel`: `"admin" | "member"`
- `Role`: `"super_admin" | "user"`
- `AliasType`: `"trade_name" | "synonym" | "iupac" | "cas_rn"`
- `JobStatus`: `"opened" | "posted" | "active" | "paused" | "filled" | "closed"`
- `ApplicationStage`: `"applied" | "screening" | "shortlisted" | "interview_1" | "interview_2" | "reference_check" | "offer" | "placed" | "withdrawn" | "rejected"`
- `ApplicationSource`: `"seek_inbound" | "company_website" | "database_internal" | "seek_talent" | "linkedin"`
- `PlacementType`: `"permanent" | "contract"`
- `PlacementStatus`: `"confirmed" | "started" | "completed" | "cancelled"`
- `TaskType`: `"finance_invoice" | "finance_contract" | "security_clearance" | "general"`
- `CvParseStatus`: `"unparsed" | "pending" | "parsed" | "failed"`
- `CvParsedBy`: `"gemini" | "claude" | "azure" | "daxtra" | "manual"`

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

**Chemical resolution flow**
- `resolveAndPersistChemical()` in `src/lib/chemicals/resolver.ts`: checks DB cache → alias table → PubChem
- Returns `null` (not an error) when PubChem can't find the chemical — caller stores as `consultation_chemicals` row with `chemical_id = null`
- Formulation upload (`formulation-pipeline.ts`): DB-only lookup first (CAS → alt_cas → `match_chemicals_by_names` RPC); if still unresolved, calls PubChem with the uploaded CAS (or INCI name) to get the canonical CAS, then checks that against the DB (`matchedBy = "pubchem"`); only truly unknown chemicals end up unresolved
- Once a chemical is PubChem-resolved, all its synonyms are written to `chemical_aliases`, so future uploads match by any synonym

**Chemskill chemicals**
- `chemicals.source = "chemskill"`, `needs_review = true` — created via `POST /api/chemicals`
- `PushToDbDialog` in consultation context pre-fills name/CAS from the unresolved row and links back to `consultation_chemicals` via `consultation_chemical_id`; standalone mode (global Chemicals page) omits this
- Blue "Chemskill" badge + "Pending review" badge shown in chemicals list and detail page
- Migration: `supabase/migrations/20260625000002_chemical_source.sql`

**Consultation notes**
- Table: `regulatory.consultation_notes` — RLS enabled, service role only (all access via admin client in API)
- Migration: `supabase/migrations/20260625000001_consultation_notes.sql`
- Author-scoped DELETE (403 if not author)

**Timeline tab** (replaced separate Checklist + Logs tabs)
- `TimelineTab.tsx` — client component; fetches `/api/consultations/[id]/logs`, groups entries under 6 milestone sections
- Milestones: Consultation created → Chemicals → Volumes entered → Regulatory assessed → Sent for review → Assessment complete
- Milestone completion state computed server-side in `page.tsx` and passed as props; log entries grouped by action type
- Volumes and Regulatory milestones have no log events — show computed summary strings instead

**Chemical product reassignment**
- Lock icon (🔒) on every chemical row (both resolved and unresolved)
- Click → LockOpen icon (🔓) + product dropdown appears; select target product → Move button
- `PATCH /api/consultations/[id]/chemicals` with `{ id, product_name }` — separate branch from resolve flow (`{ id, chemical_id }`)
- Conflict check for resolved rows only (null chemical_ids are always distinct in unique constraint)
- Logs `chemical_reassigned` action with `{ from, to }` details; appears under Chemicals milestone in Timeline

**Consultation detail editing**
- `EditDetailsDialog.tsx` — edits title, description, due_date, frameworks, reference_number
- `PATCH /api/consultations/[id]` fetches current values first, logs `details_updated` per changed field with `{ field, old, new }`
- `reference_number` auto-generated as `CS-YYYY-NNN` on creation if not provided

**Recruitment schema** (`supabase/migrations/20260630000001_recruitment_schema.sql`)

Tables (dependency order): `candidates` → `jobs` → `job_events` → `applications` → `application_stage_history` → `placements` → `tasks`

Key cross-schema FKs:
- `jobs.company_id → public.companies(id) ON DELETE RESTRICT`
- `candidates.added_by → public.profiles(id) ON DELETE SET NULL`
- All `performed_by`, `assigned_to`, `confirmed_by`, `submitted_by` → `public.profiles(id)`

**Application source channel codes** (mandatory on every application, no default):
- `seek_inbound` [S] — Seek Apply API (direct or via aggregator)
- `company_website` [CS] — Google Forms / career page
- `database_internal` [DB] — Internal talent pool assignment
- `seek_talent` [ST] — Seek Talent Search (manual recruiter sourcing)
- `linkedin` [LI] — LinkedIn (manual recruiter sourcing)

**Candidate FTS** (`search_candidates` RPC):
- `fts_vector` GENERATED ALWAYS AS STORED on `first_name + last_name + current_title + current_employer + raw_resume_text`
- GIN index on `fts_vector` and `skills_tags`; call via `supabase.schema("recruitment").rpc("search_candidates", { query_text, lim })`

**Deduplication** (`upsert_candidate` RPC):
- Matches on `lower(email)` first, then `phone`; on collision fills only NULL/empty fields (COALESCE — never overwrites)
- Returns `{ candidate_id, action: "inserted" | "collision_merged", completeness_pct }`
- `profile_completeness_pct` (0–100) computed from 8 optional fields; `completeness_prompted` flag for UI nudge

**Job events (Timeline)**:
- `job_events` has NO update trigger — API must insert explicitly (same pattern as `consultation_logs` + `logConsultationEvent()`)
- `event_type` mirrors job `status` values plus `'note'` for free-text entries

**Application stage history (BR-007)**:
- Trigger `trg_log_application_stage_change` auto-inserts on `applications.stage` UPDATE (`changed_by = NULL`)
- Trigger does NOT fire on INSERT — API must explicitly insert the initial `'applied'` row with user context
- `v_stagnant_applications` view: active applications where `updated_at < now() - 5 days`; returns `days_in_stage` float

**Placement tasks (BR-008/009/011)**:
- Trigger `trg_create_placement_tasks` fires AFTER INSERT on `placements` (not on UPDATE)
- Always creates: `finance_contract` + `finance_invoice` tasks
- Creates `security_clearance` task if `jobs.security_clearance_required = true`
- All tasks created with `assigned_to = NULL`; app layer routes by `task_type` to finance team or security officer

**CV parse tracking** (Gemini-ready, no DDL changes needed when parser is built):
- `candidates.cv_parse_status`: `'unparsed' → 'pending' → 'parsed' | 'failed'`
- `candidates.cv_parsed_by`: `'gemini' | 'claude' | 'azure' | 'daxtra' | 'manual'`
- `candidates.cv_parsed_at`: timestamptz
- Batch query: `SELECT a.cv_storage_key FROM applications a JOIN candidates c ON c.id = a.candidate_id WHERE c.cv_parse_status = 'unparsed' AND a.cv_storage_key IS NOT NULL`
- Parsed output writes to: `raw_resume_text` (activates fts_vector), `parsed_metadata` (jsonb), `skills_tags` (array)

**Recruitment RLS**: single `FOR ALL TO authenticated` policy per table using `has_module_access('recruitment')` — same pattern as regulatory. `service_role` bypasses RLS automatically (BYPASSRLS at role level).

## Commands

```bash
npm run dev      # Start dev server (Turbopack)
npm run build    # Production build
npm run lint     # ESLint
```

