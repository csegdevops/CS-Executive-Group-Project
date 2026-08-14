"use client"

import { Sheet, SheetContent } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { DocumentPreviewPane, type DocumentPreviewTarget } from "./DocumentPreviewSheet"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  documentTarget: DocumentPreviewTarget | null
  onCloseDocument: () => void
  children: React.ReactNode
}

// Shared two-column shell for the Applications/Candidates detail sheets: a
// profile column plus, once a CV/cover letter is requested, a document
// column beside it — instead of a second Sheet stacking on top and covering
// the first. The whole sheet widens (its right edge stays pinned, so the
// left edge moves further left) to make room; closing the document narrows
// it back down. Below `sm` there's no room for two columns, so the document
// pane replaces the profile column full-width instead.
export function SplitSheetContent({ open, onOpenChange, documentTarget, onCloseDocument, children }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className={cn(
          "w-full p-0 flex flex-row gap-0 overflow-hidden transition-[max-width] duration-300 ease-in-out",
          documentTarget ? "sm:max-w-5xl" : "sm:max-w-2xl"
        )}
        // The document pane's own header occupies the top-right corner with
        // its Download button once open — the base Sheet's floating close X
        // would sit right on top of it. Escape / overlay-click still close
        // the whole sheet either way, so it's safe to hide the redundant X.
        showCloseButton={!documentTarget}
      >
        <div className={cn("flex-1 min-w-0 overflow-y-auto", documentTarget && "hidden sm:block")}>
          {children}
        </div>
        {documentTarget && (
          <div className="w-full sm:w-[420px] sm:shrink-0 sm:border-l flex flex-col animate-in slide-in-from-right duration-300">
            <DocumentPreviewPane target={documentTarget} onClose={onCloseDocument} />
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
