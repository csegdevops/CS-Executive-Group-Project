"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AddressAutocomplete, emptyAddress, type AddressFields } from "@/components/ui/AddressAutocomplete"
import { Plus, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface Industry { value: string; label: string }

export function CreateCompanyDialog() {
  const router = useRouter()
  const [open, setOpen]         = useState(false)
  const [loading, setLoading]   = useState(false)
  const [industries, setIndustries] = useState<Industry[]>([])
  const [form, setForm]         = useState({ name: "", abn: "", industry: "" })
  const [address, setAddress]   = useState<AddressFields>(emptyAddress)

  useEffect(() => {
    if (!open) return
    fetch("/api/lookup-values?scope=global&category=company_industry")
      .then(r => r.json())
      .then(data => setIndustries(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [open])

  function set(k: keyof typeof form, v: string) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setLoading(true)
    try {
      const body = {
        name:          form.name.trim(),
        abn:           form.abn.trim() || undefined,
        industry:      form.industry   || undefined,
        address_line1: address.address_line1 || undefined,
        address_line2: address.address_line2 || undefined,
        suburb:        address.suburb        || undefined,
        state:         address.state         || undefined,
        postcode:      address.postcode      || undefined,
        country:       address.country       || undefined,
      }
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? "Failed to create company")
        return
      }
      toast.success("Company created")
      setOpen(false)
      setForm({ name: "", abn: "", industry: "" })
      setAddress(emptyAddress)
      router.refresh()
    } catch {
      toast.error("Network error")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" />New Company</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New Company</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label>Company name *</Label>
            <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="Acme Pty Ltd" required />
          </div>

          {/* ABN + Industry */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>ABN</Label>
              <Input value={form.abn} onChange={e => set("abn", e.target.value)} placeholder="XX XXX XXX XXX" />
            </div>
            <div className="space-y-1.5">
              <Label>Industry</Label>
              <Select value={form.industry} onValueChange={v => set("industry", v)}>
                <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                <SelectContent>
                  {industries.map(i => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Address — Head Office */}
          <div className="border-t pt-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Head Office Address</p>
            <AddressAutocomplete value={address} onChange={setAddress} />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !form.name.trim()}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
