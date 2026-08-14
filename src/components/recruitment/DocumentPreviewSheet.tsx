"use client"

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Download, X } from "lucide-react"

export interface DocumentPreviewTarget {
  inlineUrl: string
  downloadUrl: string
  fileName: string | null
  title?: string
}

const PREVIEWABLE_EXT = new Set(["pdf", "docx"])

// Pure content — header + preview body, no Sheet/Portal/Overlay. Used both
// standalone (wrapped below) and embedded side-by-side in SplitSheetContent,
// where it needs its own "close just this pane" control distinct from the
// host Sheet's global close button.
export function DocumentPreviewPane({ target, onClose }: { target: DocumentPreviewTarget; onClose: () => void }) {
  const ext = target.fileName?.split(".").pop()?.toLowerCase() ?? ""
  const canPreview = PREVIEWABLE_EXT.has(ext)
  // #toolbar=0 hides Chromium's built-in PDF viewer chrome (its own zoom/print/
  // download controls) so a PDF sits in the same plain framed page as the
  // docx preview, using only our own header's Download button.
  const iframeSrc = ext === "pdf" ? `${target.inlineUrl}#toolbar=0&navpanes=0` : target.inlineUrl

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-2 p-4 border-b">
        <div className="flex items-center gap-1.5 min-w-0">
          <Button variant="ghost" size="icon" className="h-6 w-6 -ml-1.5 shrink-0" onClick={onClose} title="Close preview">
            <X className="h-3.5 w-3.5" />
          </Button>
          <p className="font-semibold text-foreground truncate">{target.fileName ?? target.title ?? "Document"}</p>
        </div>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 shrink-0" asChild>
          <a href={target.downloadUrl}>
            <Download className="h-3.5 w-3.5" />Download
          </a>
        </Button>
      </div>
      <div className="flex-1 min-h-0 bg-muted/30 p-3">
        {canPreview ? (
          <iframe
            src={iframeSrc}
            title={target.fileName ?? "Document preview"}
            className="w-full h-full border rounded-md bg-white shadow-sm"
            // No `sandbox` attribute: Chrome's built-in PDF viewer runs as
            // an internal extension (MimeHandlerView) and refuses to load
            // inside *any* sandboxed iframe, regardless of which flags are
            // granted ("This content is blocked"). Safe to leave
            // unsandboxed here since the framed content is always our own
            // server response (native PDF render or mammoth-generated HTML
            // with no script tags), never arbitrary third-party markup.
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-sm text-muted-foreground p-4 text-center">
            <p>Preview isn&apos;t available for this file type.</p>
            <Button size="sm" asChild>
              <a href={target.downloadUrl}>
                <Download className="h-3.5 w-3.5 mr-1.5" />Download {target.fileName ?? "file"}
              </a>
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export function DocumentPreviewSheet({ target, onOpenChange }: { target: DocumentPreviewTarget | null; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={!!target} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-2xl w-full p-0 flex flex-col gap-0" showCloseButton={false}>
        <SheetHeader className="sr-only">
          <SheetTitle>{target?.fileName ?? target?.title ?? "Document"}</SheetTitle>
        </SheetHeader>
        {target && <DocumentPreviewPane target={target} onClose={() => onOpenChange(false)} />}
      </SheetContent>
    </Sheet>
  )
}
