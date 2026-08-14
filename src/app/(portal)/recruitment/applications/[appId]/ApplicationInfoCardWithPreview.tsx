"use client"

import { useState } from "react"
import { ApplicationInfoCard, type ApplicationInfo } from "./ApplicationInfoCard"
import { DocumentPreviewSheet, type DocumentPreviewTarget } from "@/components/recruitment/DocumentPreviewSheet"

// Standalone-page counterpart to how ApplicationDetailSheet wires preview
// through SplitSheetContent — this page isn't inside a sheet, so it just
// falls back to the plain stacked-overlay DocumentPreviewSheet.
export function ApplicationInfoCardWithPreview({ app }: { app: ApplicationInfo }) {
  const [preview, setPreview] = useState<DocumentPreviewTarget | null>(null)

  return (
    <>
      <ApplicationInfoCard
        app={app}
        onPreview={(type, fileName) => setPreview({
          inlineUrl: `/api/recruitment/applications/${app.id}/cv?type=${type}&disposition=inline`,
          downloadUrl: `/api/recruitment/applications/${app.id}/cv?type=${type}`,
          fileName,
          title: type === "cl" ? "Cover letter" : "CV",
        })}
      />
      <DocumentPreviewSheet target={preview} onOpenChange={(open) => { if (!open) setPreview(null) }} />
    </>
  )
}
