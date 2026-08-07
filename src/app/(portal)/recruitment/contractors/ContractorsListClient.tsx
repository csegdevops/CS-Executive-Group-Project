"use client"

import { useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Search } from "lucide-react"

interface Contract {
  id: string
  contract_number: string | null
  status: "active" | "expired" | "terminated"
  start_date: string | null
  finish_date: string | null
  candidate_name: string
  job_title: string | null
  company_id: string | null
  company_name: string | null
}

interface Props {
  contracts: Contract[]
  companyOptions: { id: string; name: string }[]
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-50 text-green-700",
  expired: "bg-gray-100 text-gray-500",
  terminated: "bg-red-50 text-red-600",
}

function isExpiringSoon(finishDate: string | null): boolean {
  if (!finishDate) return false
  const days = (new Date(finishDate).getTime() - Date.now()) / 86400000
  return days >= 0 && days <= 30
}

export function ContractorsListClient({ contracts, companyOptions }: Props) {
  const [q, setQ] = useState("")
  const [status, setStatus] = useState("")
  const [companyId, setCompanyId] = useState("")

  const filtered = contracts.filter((c) => {
    if (status && c.status !== status) return false
    if (companyId && c.company_id !== companyId) return false
    if (q) {
      const s = q.toLowerCase()
      return (
        c.candidate_name.toLowerCase().includes(s) ||
        (c.job_title ?? "").toLowerCase().includes(s) ||
        (c.company_name ?? "").toLowerCase().includes(s) ||
        (c.contract_number ?? "").toLowerCase().includes(s)
      )
    }
    return true
  })

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search contractor, job, company…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="h-8 px-2 text-xs rounded-md border border-border bg-background"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="terminated">Terminated</option>
        </select>
        {companyOptions.length > 0 && (
          <select
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
            className="h-8 px-2 text-xs rounded-md border border-border bg-background"
          >
            <option value="">All companies</option>
            {companyOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
        {(q || status || companyId) && (
          <button
            onClick={() => { setQ(""); setStatus(""); setCompanyId("") }}
            className="h-8 px-3 text-xs rounded-md border border-border text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>

      <p className="text-xs text-muted-foreground mb-3">{filtered.length} contract{filtered.length !== 1 ? "s" : ""}</p>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-sm text-muted-foreground border rounded-lg">No contracts match the current filters.</div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Contractor</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs hidden md:table-cell">Job</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs hidden md:table-cell">Company</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs">Status</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground text-xs hidden sm:table-cell">Finish date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/recruitment/contractors/${c.id}`} className="font-medium hover:underline">
                      {c.candidate_name}
                    </Link>
                    {c.contract_number && <p className="text-xs text-muted-foreground">{c.contract_number}</p>}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-sm">{c.job_title ?? "—"}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-sm">{c.company_name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={cn("text-xs", STATUS_COLORS[c.status] ?? "")}>
                      {c.status[0].toUpperCase() + c.status.slice(1)}
                    </Badge>
                    {c.status === "active" && isExpiringSoon(c.finish_date) && (
                      <Badge variant="outline" className="ml-1.5 text-xs bg-amber-50 text-amber-700">Expiring soon</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-sm text-muted-foreground">
                    {c.finish_date ? new Date(c.finish_date).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "Ongoing"}
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
