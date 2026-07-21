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
        { key: "regulatory.consultations.edit", label: "Edit consultations (status, chemicals, products, notes, uploads)" },
      ],
    },
    { category: "Consultants", permissions: [{ key: "regulatory.consultants.manage", label: "Assign consultants to consultations/companies" }] },
    { category: "Chemicals", permissions: [{ key: "regulatory.chemicals.manage", label: "Manage the chemical database" }] },
    { category: "Companies", permissions: [{ key: "companies.manage", label: "Create & edit companies, branches, contacts, activity log" }] },
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
    { category: "Companies", permissions: [{ key: "companies.manage", label: "Create & edit companies, branches, contacts, activity log" }] },
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
    { category: "Companies", permissions: [{ key: "companies.manage", label: "Create & edit companies, branches, contacts, activity log" }] },
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
  if (key === "companies.manage") return "Companies"
  const parts = key.split(".")
  const rest = parts[0] in PERMISSION_CATALOG ? parts.slice(1) : parts
  return rest
    .map((part) => part.replace(/_/g, " "))
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(": ")
}
