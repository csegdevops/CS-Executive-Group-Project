"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { ProvisionContractorDialog } from "./ProvisionContractorDialog"

interface Company { id: string; name: string }
interface ContractorRow {
  id: string
  full_name: string
  email: string
  company_name: string
  is_active: boolean
  contract_status: string | null
}

const STATUS_BADGE: Record<string, string> = {
  active:     "bg-green-50 text-green-700 border-green-200",
  expired:    "bg-amber-50 text-amber-700 border-amber-200",
  terminated: "bg-red-50 text-red-700 border-red-200",
}

export function ContractorsListClient({ initialContractors, companies }: { initialContractors: ContractorRow[]; companies: Company[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />Provision Contractor
        </Button>
      </div>

      {initialContractors.length === 0 ? (
        <div className="border rounded-lg text-center py-16 text-muted-foreground text-sm">
          No contractors yet.
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Contractor</th>
                <th className="text-left px-4 py-3 font-medium">Company</th>
                <th className="text-left px-4 py-3 font-medium">Contract</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {initialContractors.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/timesheets/contractors/${c.id}`} className="font-medium hover:underline">{c.full_name}</Link>
                    <p className="text-xs text-muted-foreground">{c.email}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.company_name}</td>
                  <td className="px-4 py-3">
                    {c.contract_status ? (
                      <Badge variant="outline" className={`text-xs ${STATUS_BADGE[c.contract_status] ?? ""}`}>{c.contract_status}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {c.is_active
                      ? <Badge variant="outline" className="text-xs text-blue-700 border-blue-300 bg-blue-50">Active</Badge>
                      : <Badge variant="outline" className="text-xs text-muted-foreground">Inactive</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ProvisionContractorDialog
        open={open}
        onOpenChange={setOpen}
        companies={companies}
        onCreated={() => { setOpen(false); router.refresh() }}
      />
    </div>
  )
}
