"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Loader2, Upload, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { JobDocumentsSection } from "./JobDocumentsSection"

interface Props {
  jobId: string
  isExecutiveSearch: boolean
  confidentialMode: boolean
  narrativeCopy: string | null
  hasHeroImage: boolean
  documents: { id: string; original_name: string | null; created_at: string }[]
}

async function patchJob(jobId: string, body: Record<string, unknown>) {
  const res = await fetch(`/api/recruitment/jobs/${jobId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? "Update failed")
  }
}

export function JobExecutiveSearchTab({ jobId, isExecutiveSearch, confidentialMode, narrativeCopy, hasHeroImage, documents }: Props) {
  const router = useRouter()
  const heroInputRef = useRef<HTMLInputElement>(null)
  const [narrative, setNarrative] = useState(narrativeCopy ?? "")
  const [savingNarrative, setSavingNarrative] = useState(false)
  const [togglingFlag, setTogglingFlag] = useState<"exec" | "confidential" | null>(null)
  const [uploadingHero, setUploadingHero] = useState(false)
  const [removingHero, setRemovingHero] = useState(false)

  async function toggleExecutiveSearch(checked: boolean) {
    setTogglingFlag("exec")
    try {
      await patchJob(jobId, { is_executive_search: checked })
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update")
    } finally {
      setTogglingFlag(null)
    }
  }

  async function toggleConfidential(checked: boolean) {
    setTogglingFlag("confidential")
    try {
      await patchJob(jobId, { confidential_mode: checked })
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update")
    } finally {
      setTogglingFlag(null)
    }
  }

  async function saveNarrative() {
    setSavingNarrative(true)
    try {
      await patchJob(jobId, { narrative_copy: narrative })
      toast.success("Narrative copy saved")
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save")
    } finally {
      setSavingNarrative(false)
    }
  }

  async function handleHeroUpload(file: File) {
    setUploadingHero(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch(`/api/recruitment/jobs/${jobId}/hero-image`, { method: "POST", body: formData })
      if (!res.ok) { toast.error("Hero image upload failed"); return }
      toast.success("Hero image updated")
      router.refresh()
    } finally {
      setUploadingHero(false)
      if (heroInputRef.current) heroInputRef.current.value = ""
    }
  }

  async function handleHeroRemove() {
    setRemovingHero(true)
    try {
      const res = await fetch(`/api/recruitment/jobs/${jobId}/hero-image`, { method: "DELETE" })
      if (!res.ok) { toast.error("Failed to remove hero image"); return }
      toast.success("Hero image removed")
      router.refresh()
    } finally {
      setRemovingHero(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="exec-search"
            checked={isExecutiveSearch}
            disabled={togglingFlag === "exec"}
            onCheckedChange={(v) => toggleExecutiveSearch(v === true)}
          />
          <Label htmlFor="exec-search" className="text-sm font-normal">
            This is an executive search — eligible for the WordPress microsite treatment
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="confidential-mode"
            checked={confidentialMode}
            disabled={!isExecutiveSearch || togglingFlag === "confidential"}
            onCheckedChange={(v) => toggleConfidential(v === true)}
          />
          <Label htmlFor="confidential-mode" className="text-sm font-normal">
            Confidential — hide company name/logo on the public microsite
          </Label>
        </div>
      </div>

      {!isExecutiveSearch ? (
        <p className="text-sm text-muted-foreground">
          Enable &quot;This is an executive search&quot; above to manage hero image, narrative copy, and information packs.
        </p>
      ) : (
        <>
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <h3 className="font-medium text-sm">Hero Image</h3>
            {hasHeroImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/recruitment/jobs/${jobId}/hero-image`}
                alt="Hero"
                className="w-full max-h-56 object-cover rounded-md border"
              />
            ) : (
              <p className="text-xs text-muted-foreground">No hero image uploaded.</p>
            )}
            <div className="flex items-center gap-2">
              <input
                ref={heroInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleHeroUpload(f) }}
              />
              <Button size="sm" variant="outline" onClick={() => heroInputRef.current?.click()} disabled={uploadingHero}>
                {uploadingHero ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {hasHeroImage ? "Replace" : "Upload"}
              </Button>
              {hasHeroImage && (
                <Button size="sm" variant="ghost" onClick={handleHeroRemove} disabled={removingHero} className="text-destructive hover:text-destructive">
                  {removingHero ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  Remove
                </Button>
              )}
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4 space-y-3">
            <h3 className="font-medium text-sm">Narrative Copy</h3>
            <p className="text-xs text-muted-foreground">
              Richer &quot;About this opportunity&quot; copy for the public microsite, separate from the internal description/requirements.
            </p>
            <textarea
              rows={8}
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              placeholder="Write the story of this opportunity for the public microsite…"
              className="w-full text-sm rounded-md border border-border bg-background px-3 py-2 resize-y min-h-32 focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <Button size="sm" onClick={saveNarrative} disabled={savingNarrative || narrative === (narrativeCopy ?? "")}>
              {savingNarrative ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Save
            </Button>
          </div>

          <JobDocumentsSection jobId={jobId} documents={documents} />
        </>
      )}
    </div>
  )
}
