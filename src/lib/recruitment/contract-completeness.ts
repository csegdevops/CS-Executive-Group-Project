// A contract is "incomplete" if it's missing any of the fields a recruiter
// needs to have actually agreed with the client/contractor before the
// engagement is real — surfaced as a warning badge on the contract itself
// and rolled up into a sidebar nav count so recruiters notice without
// having to open every contractor.
export interface ContractCompletenessFields {
  award: string | null
  award_level: string | null
  pay_rate: number | null
  start_date: string | null
  finish_date: string | null
}

const FIELD_LABELS: { key: keyof ContractCompletenessFields; label: string }[] = [
  { key: "award", label: "award" },
  { key: "award_level", label: "award level" },
  { key: "pay_rate", label: "pay rate" },
  { key: "start_date", label: "start date" },
  { key: "finish_date", label: "finish date" },
]

export function getMissingContractFields(contract: ContractCompletenessFields): string[] {
  return FIELD_LABELS.filter(({ key }) => contract[key] == null || contract[key] === "").map(({ label }) => label)
}

export function isContractIncomplete(contract: ContractCompletenessFields): boolean {
  return getMissingContractFields(contract).length > 0
}
