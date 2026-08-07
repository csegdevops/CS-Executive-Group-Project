"use client"

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"

export interface DocumentPreviewTarget {
  inlineUrl: string
  downloadUrl: string
  fileName: string | null
  title?: string
}

const PREVIEWABLE_EXT = new Set(["pdf", "docx"])

export function DocumentPreviewSheet({ target, onOpenChange }: { target: DocumentPreviewTarget | null; onOpenChange: (open: boolean) => void }) {
  const ext = target?.fileName?.split(".").pop()?.toLowerCase() ?? ""
  const canPreview = PREVIEWABLE_EXT.has(ext)
  // #toolbar=0 hides Chromium's built-in PDF viewer chrome (its own zoom/print/
  // download controls) so a PDF sits in the same plain framed page as the
  // docx preview, using only our own header's Download button.
  const iframeSrc = target && ext === "pdf" ? `${target.inlineUrl}#toolbar=0&navpanes=0` : target?.inlineUrl ?? ""

  return (
    <Sheet open={!!target} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-2xl w-full p-0 flex flex-col">
        <SheetHeader className="flex-row items-center justify-between pr-10 border-b">
          <SheetTitle className="truncate">{target?.fileName ?? target?.title ?? "Document"}</SheetTitle>
          {target && (
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" asChild>
              <a href={target.downloadUrl}>
                <Download className="h-3.5 w-3.5" />Download
              </a>
            </Button>
          )}
        </SheetHeader>
        <div className="flex-1 min-h-0 bg-muted/30 p-3">
          {canPreview ? (
            <iframe
              src={iframeSrc}
              title={target?.fileName ?? "Document preview"}
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
                <a href={target?.downloadUrl}>
                  <Download className="h-3.5 w-3.5 mr-1.5" />Download {target?.fileName ?? "file"}
                </a>
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
