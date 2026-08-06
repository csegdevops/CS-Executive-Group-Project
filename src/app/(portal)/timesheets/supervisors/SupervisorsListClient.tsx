"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { ProvisionSupervisorDialog } from "./ProvisionSupervisorDialog"

interface Company { id: string; name: string }
interface SupervisorRow {
  id: string
  full_name: string
  email: string
  company_name: string
  is_active: boolean
  active_contractor_count: number
}

export function SupervisorsListClient({ initialSupervisors, companies }: { initialSupervisors: SupervisorRow[]; companies: Company[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />Provision Supervisor
        </Button>
      </div>

      {initialSupervisors.length === 0 ? (
        <div className="border rounded-lg text-center py-16 text-muted-foreground text-sm">
          No supervisors yet.
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Supervisor</th>
                <th className="text-left px-4 py-3 font-medium">Company</th>
                <th className="text-left px-4 py-3 font-medium">Active Contractors</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {initialSupervisors.map((s) => (
                <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium">{s.full_name}</p>
                    <p className="text-xs text-muted-foreground">{s.email}</p>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{s.company_name}</td>
                  <td className="px-4 py-3">
                    {s.active_contractor_count > 0 ? (
                      <Badge variant="outline" className="text-xs text-blue-700 border-blue-300 bg-blue-50">{s.active_contractor_count}</Badge>
                    ) : <span className="text-muted-foreground text-xs">None</span>}
                  </td>
                  <td className="px-4 py-3">
                    {s.is_active
                      ? <Badge variant="outline" className="text-xs text-blue-700 border-blue-300 bg-blue-50">Active</Badge>
                      : <Badge variant="outline" className="text-xs text-muted-foreground">Inactive</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ProvisionSupervisorDialog
        open={open}
        onOpenChange={setOpen}
        companies={companies}
        onCreated={() => { setOpen(false); router.refresh() }}
      />
    </div>
  )
}
