"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface EditProfileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userName: string | null
  email: string
}

export function EditProfileDialog({ open, onOpenChange, userName, email }: EditProfileDialogProps) {
  const router = useRouter()
  const [fullName, setFullName] = useState(userName ?? "")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)

  function reset() {
    setNewPassword("")
    setConfirmPassword("")
    setShowPassword(false)
  }

  async function handleSave() {
    if (!fullName.trim()) { toast.error("Name is required"); return }
    if (newPassword && newPassword.length < 8) { toast.error("Password must be at least 8 characters."); return }
    if (newPassword && newPassword !== confirmPassword) { toast.error("Passwords do not match."); return }

    setSaving(true)
    try {
      if (fullName.trim() !== (userName ?? "")) {
        const res = await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ full_name: fullName.trim() }),
        })
        if (!res.ok) {
          const err = await res.json()
          toast.error(err.error ?? "Failed to update name")
          return
        }
      }

      if (newPassword) {
        const supabase = createClient()
        const { error } = await supabase.auth.updateUser({ password: newPassword })
        if (error) {
          toast.error(error.message)
          return
        }
      }

      toast.success("Profile updated")
      reset()
      onOpenChange(false)
      router.refresh()
    } catch {
      toast.error("Network error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) reset(); onOpenChange(next) }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={email} disabled className="text-muted-foreground" />
          </div>

          <div className="space-y-2">
            <Label>New Password</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Leave blank to keep current password"
                autoComplete="new-password"
                className="pr-9"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {newPassword && (
            <div className="space-y-2">
              <Label>Confirm New Password</Label>
              <Input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
