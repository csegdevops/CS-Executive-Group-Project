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
 * shared (non-module-prefixed) key shown identically in the Regulatory,
 * Recruitment, and CRM tabs since `companies` is a genuinely cross-module
 * table.
 */
export const PERMISSION_CATALOG: Record<Module, PermissionCategory[]> = {
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
      ],
    },
    { category: "Placements", permissions: [{ key: "recruitment.placements.create", label: "Create placements" }] },
    { category: "Tasks", permissions: [{ key: "recruitment.tasks.edit", label: "Manage tasks" }] },
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
  crm: [
    { category: "Module", permissions: [{ key: "crm.access", label: "Access the CRM module" }] },
    {
      category: "Opportunities",
      permissions: [
        { key: "crm.opportunities.create", label: "Create opportunities" },
        { key: "crm.opportunities.edit", label: "Edit opportunities" },
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
    { category: "Reference Data", permissions: [{ key: "crm.reference_data.manage", label: "Manage CRM reference data" }] },
  ],
}

export const MODULE_LABELS: Record<Module, string> = {
  regulatory: "Regulatory",
  recruitment: "Recruitment",
  crm: "CRM",
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
