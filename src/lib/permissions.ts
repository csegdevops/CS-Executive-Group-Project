import type { Module } from "@/types/database"

export interface PermissionDef {
  key: string
  label: string
}

export interface PermissionCategory {
  category: string
  permissions: PermissionDef[]
}

/**
 * Full permission catalog, grouped by module. `companies.manage` is a
 * shared (non-module-prefixed) key shown identically in the Regulatory
 * and Recruitment tabs since `companies` is a genuinely cross-module
 * table.
 */
/** "Platform" isn't a real switchable module (no module_config row, nobody
 * switches into it) — it's a UI-only 4th tab in the permissions picker for
 * platform-wide admin settings that aren't scoped to any one business module. */
export type PermissionTab = Module | "platform" | "ai"

export const PERMISSION_CATALOG: Record<PermissionTab, PermissionCategory[]> = {
  regulatory: [
    { category: "Module", permissions: [{ key: "regulatory.access", label: "Access the Regulatory module" }] },
    {
      category: "Consultations",
      permissions: [
        { key: "regulatory.consultations.create", label: "Create consultations" },
        { key: "regulatory.consultations.edit_details", label: "Edit consultation details (title, status, frameworks, due date)" },
        { key: "regulatory.consultations.chemicals", label: "Add, resolve & remove consultation chemicals" },
        { key: "regulatory.consultations.volumes", label: "Edit products & import volumes" },
        { key: "regulatory.consultations.upload", label: "Upload formulation files" },
        { key: "regulatory.consultations.notes", label: "Add & delete consultant notes" },
      ],
    },
    { category: "Consultants", permissions: [{ key: "regulatory.consultants.manage", label: "Assign consultants to consultations/companies" }] },
    {
      category: "Chemicals",
      permissions: [
        { key: "regulatory.chemicals.manage", label: "Manage the chemical database" },
        { key: "regulatory.chemicals.regulatory_status", label: "Edit per-framework regulatory status" },
      ],
    },
    {
      category: "Companies",
      permissions: [
        { key: "companies.create", label: "Manually register a company" },
        { key: "companies.edit", label: "Edit company details & activity log" },
        { key: "companies.contacts.manage", label: "Add, edit & delete company contacts" },
        { key: "companies.branches.manage", label: "Add, edit & delete branches" },
      ],
    },
    { category: "Regulatory Lists", permissions: [{ key: "regulatory.regulatory_lists.manage", label: "Import AICIS/REACH/TSCA lists" }] },
    { category: "Reference Data", permissions: [{ key: "regulatory.reference_data.manage", label: "Manage Regulatory reference data" }] },
  ],
  recruitment: [
    { category: "Module", permissions: [{ key: "recruitment.access", label: "Access the Recruitment module" }] },
    {
      category: "Jobs",
      permissions: [
        { key: "recruitment.jobs.create", label: "Create jobs" },
        { key: "recruitment.jobs.edit", label: "Edit jobs (incl. Seek publish/unpublish)" },
      ],
    },
    {
      category: "Candidates",
      permissions: [
        { key: "recruitment.candidates.create", label: "Create candidates" },
        { key: "recruitment.candidates.edit", label: "Edit candidates (incl. CV upload, re-parse)" },
        { key: "recruitment.candidates.merge", label: "Merge duplicate candidate profiles" },
      ],
    },
    {
      category: "Applications",
      permissions: [
        { key: "recruitment.applications.create", label: "Create applications" },
        { key: "recruitment.applications.edit", label: "Edit applications / change stage" },
        { key: "recruitment.applications.delete", label: "Delete applications" },
      ],
    },
    { category: "Placements", permissions: [{ key: "recruitment.placements.create", label: "Create placements" }] },
    {
      category: "Contracts",
      permissions: [
        { key: "recruitment.contracts.edit_dates", label: "Edit contract start & finish dates" },
        { key: "recruitment.contracts.manage", label: "Extend, renew, terminate & manage contract documents" },
      ],
    },
    { category: "Tasks", permissions: [{ key: "recruitment.tasks.edit", label: "Manage tasks" }] },
    {
      category: "Opportunities",
      permissions: [
        { key: "recruitment.opportunities.create", label: "Create opportunities" },
        { key: "recruitment.opportunities.edit", label: "Edit opportunities" },
      ],
    },
    {
      category: "Companies",
      permissions: [
        { key: "companies.create", label: "Manually register a company" },
        { key: "companies.edit", label: "Edit company details & activity log" },
        { key: "companies.contacts.manage", label: "Add, edit & delete company contacts" },
        { key: "companies.branches.manage", label: "Add, edit & delete branches" },
      ],
    },
    { category: "Reference Data", permissions: [{ key: "recruitment.reference_data.manage", label: "Manage Recruitment reference data" }] },
  ],
  timesheets: [
    { category: "Module", permissions: [{ key: "timesheets.access", label: "Access the Timesheets module" }] },
    {
      category: "Contractors",
      permissions: [
        { key: "timesheets.contractors.manage", label: "Provision contractors & manage supervisor assignments" },
      ],
    },
    { category: "Contracts", permissions: [{ key: "timesheets.contracts.manage", label: "Create, extend & terminate contracts" }] },
    { category: "Supervisors", permissions: [{ key: "timesheets.supervisors.manage", label: "Provision supervisors" }] },
    { category: "Timesheets", permissions: [{ key: "timesheets.timesheets.oversee", label: "View & oversee all submitted timesheets" }] },
    {
      category: "Companies",
      permissions: [
        { key: "companies.create", label: "Manually register a company" },
        { key: "companies.edit", label: "Edit company details & activity log" },
        { key: "companies.contacts.manage", label: "Add, edit & delete company contacts" },
        { key: "companies.branches.manage", label: "Add, edit & delete branches" },
      ],
    },
  ],
  ims: [
    { category: "Module", permissions: [{ key: "ims.access", label: "Access the IMS module" }] },
    { category: "Computers", permissions: [{ key: "ims.computers.manage", label: "Manage computer inventory & logins" }] },
    { category: "Service Accounts", permissions: [{ key: "ims.service_accounts.manage", label: "Manage website & service accounts" }] },
    { category: "Network", permissions: [{ key: "ims.network.manage", label: "Manage wifi & router details" }] },
    { category: "VPN", permissions: [{ key: "ims.vpn.manage", label: "Manage VPN accounts" }] },
  ],
  ai: [
    { category: "CV Parsing", permissions: [{ key: "ai.cv_parsing.use", label: "Trigger CV parsing (Gemini)" }] },
    { category: "Summaries", permissions: [{ key: "ai.summaries.use", label: "Generate AI summaries (consultations & companies)" }] },
    { category: "Formulation", permissions: [{ key: "ai.formulation.use", label: "Use AI formulation fallback (non-spreadsheet / unrecognised files)" }] },
    { category: "Controls", permissions: [{ key: "ai.pause.manage", label: "Pause & resume AI features" }] },
  ],
  platform: [
    {
      category: "Settings",
      permissions: [
        { key: "platform_settings.view", label: "View platform settings" },
        { key: "platform_settings.manage", label: "Edit platform settings (module toggles, email/AI pause)" },
      ],
    },
  ],
}

export const MODULE_LABELS: Record<PermissionTab, string> = {
  regulatory: "Regulatory",
  recruitment: "Recruitment",
  timesheets: "Timesheets",
  ims: "IMS",
  ai: "AI Features",
  platform: "Platform",
}

export function allPermissionKeys(): string[] {
  const keys = new Set<string>()
  for (const categories of Object.values(PERMISSION_CATALOG)) {
    for (const { permissions } of categories) {
      for (const p of permissions) keys.add(p.key)
    }
  }
  return [...keys]
}

export function permissionLabel(key: string): string {
  for (const categories of Object.values(PERMISSION_CATALOG)) {
    for (const { permissions } of categories) {
      const found = permissions.find((p) => p.key === key)
      if (found) return found.label
    }
  }
  return key
}

/** Compact form for badges, e.g. "regulatory.consultations.create" -> "Consultations: Create". */
export function shortPermissionLabel(key: string): string {
  if (key === "companies.create") return "Companies: Register"
  if (key === "companies.edit") return "Companies: Edit"
  if (key === "companies.contacts.manage") return "Companies: Contacts"
  if (key === "companies.branches.manage") return "Companies: Branches"
  const parts = key.split(".")
  const rest = parts[0] in PERMISSION_CATALOG ? parts.slice(1) : parts
  return rest
    .map((part) => part.replace(/_/g, " "))
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(": ")
}
