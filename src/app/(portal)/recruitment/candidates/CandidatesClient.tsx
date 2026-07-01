"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Search, Shield, ChevronRight } from "lucide-react"
import { AddCandidateDialog } from "./AddCandidateDialog"

interface Candidate {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  current_title: string | null
  current_employer: string | null
  location_city: string | null
  location_state: string | null
  skills_tags: string[]
  security_clearance_level: string | null
  security_clearance_verified: boolean
  profile_completeness_pct: number
  cv_parse_status: string
  source_channel: string | null
  created_at: string
}

const SOURCE_LABELS: Record<string, string> = {
  seek_inbound: "[S]", company_website: "[CS]",
  database_internal: "[DB]", seek_talent: "[ST]", linkedin: "[LI]",
}

function CompletenessDot({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-16 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", pct >= 75 ? "bg-green-500" : pct >= 40 ? "bg-amber-500" : "bg-red-400")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground">{pct}%</span>
    </div>
  )
}

export function CandidatesClient({ candidates }: { candidates: Candidate[] }) {
  const router = useRouter()
  const [q, setQ] = useState("")
  const [searchResults, setSearchResults] = useState<Candidate[] | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleSearch(value: string) {
    setQ(value)
    if (value.length < 2) { setSearchResults(null); return }
    startTransition(async () => {
      const res = await fetch(`/api/recruitment/candidates?q=${encodeURIComponent(value)}`)
      if (res.ok) {
        const data = await res.json()
        setSearchResults(data)
      }
    })
  }

  // Local filter when no FTS search
  const localFiltered = q.length < 2
    ? candidates.filter(c => {
        if (!q) return true
        const s = q.toLowerCase()
        return (
          `${c.first_name} ${c.last_name}`.toLowerCase().includes(s) ||
          (c.email).toLowerCase().includes(s) ||
          (c.current_title ?? "").toLowerCase().includes(s)
        )
      })
    : []

  const displayList = searchResults ?? localFiltered

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className={cn(
            "absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 transition-colors",
            isPending ? "text-primary animate-pulse" : "text-muted-foreground"
          )} />
          <Input
            placeholder="Search by name, title, skills…"
            value={q}
            onChange={e => handleSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <AddCandidateDialog onAdded={() => router.refresh()} />
      </div>

      <p className="text-xs text-muted-foreground mb-3">
        {q.length >= 2
          ? searchResults === null ? "Searching…" : `${displayList.length} result${displayList.length !== 1 ? "s" : ""} for "${q}"`
          : `${displayList.length} candidate${displayList.length !== 1 ? "s" : ""}`
        }
      </p>

      {displayList.length === 0 ? (
        <div className="text-center py-16 text-sm text-muted-foreground border rounded-lg">
          {q ? "No candidates match your search." : "No candidates in the talent pool yet."}
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Candidate</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs hidden md:table-cell">Location</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs hidden lg:table-cell">Skills</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs hidden sm:table-cell">Profile</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {displayList.map(c => (
                <tr key={c.id} className="hover:bg-muted/20 transition-colors group">
                  <td className="px-4 py-3">
                    <div className="flex items-start gap-2">
                      {c.security_clearance_level && (
                        <Shield className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", c.security_clearance_verified ? "text-amber-500" : "text-muted-foreground/40")} />
                      )}
                      <div>
                        <Link href={`/recruitment/candidates/${c.id}`} className="font-medium hover:underline">
                          {c.first_name} {c.last_name}
                        </Link>
                        {c.current_title && <p className="text-xs text-muted-foreground">{c.current_title}</p>}
                        {c.current_employer && <p className="text-xs text-muted-foreground">{c.current_employer}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">
                    {[c.location_city, c.location_state].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {(c.skills_tags ?? []).slice(0, 3).map(tag => (
                        <Badge key={tag} variant="secondary" className="text-xs py-0">
                          {tag.replace(/_/g, " ")}
                        </Badge>
                      ))}
                      {c.skills_tags?.length > 3 && (
                        <span className="text-xs text-muted-foreground">+{c.skills_tags.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <CompletenessDot pct={c.profile_completeness_pct} />
                  </td>
                  <td className="px-2 py-3">
                    <Link href={`/recruitment/candidates/${c.id}`}>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
