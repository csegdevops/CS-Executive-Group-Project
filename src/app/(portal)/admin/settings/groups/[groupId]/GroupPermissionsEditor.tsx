"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { PermissionsPicker } from "../PermissionsPicker"

function sameKeys(a: string[], b: string[]) {
  if (a.length !== b.length) return false
  const sortedA = [...a].sort()
  const sortedB = [...b].sort()
  return sortedA.every((k, i) => k === sortedB[i])
}

export function GroupPermissionsEditor({
  groupId,
  initialKeys,
  locked,
}: {
  groupId: string
  initialKeys: string[]
  locked: boolean
}) {
  const router = useRouter()
  const [keys, setKeys] = useState<string[]>(initialKeys)
  const [saving, setSaving] = useState(false)
  const dirty = !sameKeys(keys, initialKeys)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/user-groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissionKeys: keys }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? "Failed to update permissions")
        return
      }
      toast.success("Permissions updated")
      router.refresh()
    } catch {
      toast.error("Network error")
    } finally {
      setSaving(false)
    }
  }

  if (locked) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        Grants full access via role — not via permissions.
      </p>
    )
  }

  return (
    <div>
      <PermissionsPicker selected={keys} onChange={setKeys} />
      {dirty && (
        <div className="flex justify-end gap-2 pt-4 mt-4 border-t">
          <Button variant="outline" size="sm" onClick={() => setKeys(initialKeys)} disabled={saving}>
            Discard
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            Save changes
          </Button>
        </div>
      )}
    </div>
  )
}
