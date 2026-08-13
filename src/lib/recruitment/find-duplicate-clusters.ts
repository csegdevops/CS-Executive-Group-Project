import { createAdminClient } from "@/lib/supabase/admin"
import { isLinkedinProfileUrl } from "./linkedin-url"

export interface CandidateDuplicateSummary {
  id: string
  first_name: string
  last_name: string
  email: string
  secondary_email: string | null
  phone: string | null
  linkedin_url: string | null
  profile_completeness_pct: number
  created_at: string
}

export interface DuplicateCluster {
  cluster_id: string
  matched_signals: string[]
  suggested_primary_id: string
  candidates: CandidateDuplicateSummary[]
}

class DisjointSet {
  private parent = new Map<string, string>()

  private root(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x)
    let r = x
    while (this.parent.get(r) !== r) r = this.parent.get(r)!
    let cur = x
    while (this.parent.get(cur) !== r) {
      const next = this.parent.get(cur)!
      this.parent.set(cur, r)
      cur = next
    }
    return r
  }

  find(x: string): string {
    return this.root(x)
  }

  union(a: string, b: string) {
    const ra = this.root(a)
    const rb = this.root(b)
    if (ra !== rb) this.parent.set(ra, rb)
  }
}

function normalizedEmails(c: { email: string; secondary_email: string | null }): string[] {
  return [c.email, c.secondary_email]
    .filter((e): e is string => !!e)
    .map((e) => e.trim().toLowerCase())
}

function normalizedLinkedin(url: string | null): string | null {
  if (!url || !isLinkedinProfileUrl(url)) return null
  return url.trim().toLowerCase().replace(/\/+$/, "")
}

/**
 * Groups candidates into possible-duplicate clusters using strong signals
 * only (email/secondary_email overlap, exact phone match, exact LinkedIn URL
 * match) — deliberately no fuzzy name matching, which risks false positives
 * on common names. Phone matching is raw-string equality since no
 * normalization utility exists anywhere in this codebase.
 */
export async function findDuplicateClusters(
  admin: ReturnType<typeof createAdminClient>
): Promise<{ clusters: DuplicateCluster[]; scanned: number }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: candidates } = await (admin.schema("recruitment") as any)
    .from("candidates")
    .select("id, first_name, last_name, email, secondary_email, phone, linkedin_url, profile_completeness_pct, created_at")
    .eq("is_active", true)

  const rows = (candidates ?? []) as CandidateDuplicateSummary[]
  const dsu = new DisjointSet()
  const signalsByCandidate = new Map<string, Set<string>>()

  function addSignal(id: string, signal: string) {
    if (!signalsByCandidate.has(id)) signalsByCandidate.set(id, new Set())
    signalsByCandidate.get(id)!.add(signal)
  }

  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i]
      const b = rows[j]
      const signals: string[] = []

      const aEmails = normalizedEmails(a)
      const bEmails = normalizedEmails(b)
      if (aEmails.some((e) => bEmails.includes(e))) signals.push("email")

      if (a.phone && b.phone && a.phone === b.phone) signals.push("phone")

      const aLi = normalizedLinkedin(a.linkedin_url)
      const bLi = normalizedLinkedin(b.linkedin_url)
      if (aLi && bLi && aLi === bLi) signals.push("linkedin")

      if (signals.length > 0) {
        dsu.union(a.id, b.id)
        for (const s of signals) {
          addSignal(a.id, s)
          addSignal(b.id, s)
        }
      }
    }
  }

  const rowById = new Map(rows.map((r) => [r.id, r]))
  const groups = new Map<string, string[]>()
  for (const r of rows) {
    const root = dsu.find(r.id)
    if (!groups.has(root)) groups.set(root, [])
    groups.get(root)!.push(r.id)
  }

  const clusters: DuplicateCluster[] = []
  for (const [root, ids] of groups) {
    if (ids.length < 2) continue

    const members = ids
      .map((id) => rowById.get(id)!)
      .sort((a, b) =>
        b.profile_completeness_pct - a.profile_completeness_pct ||
        (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0)
      )

    const matchedSignals = new Set<string>()
    for (const id of ids) {
      const s = signalsByCandidate.get(id)
      if (s) for (const sig of s) matchedSignals.add(sig)
    }

    clusters.push({
      cluster_id: root,
      matched_signals: [...matchedSignals].sort(),
      suggested_primary_id: members[0].id,
      candidates: members,
    })
  }

  return { clusters, scanned: rows.length }
}
