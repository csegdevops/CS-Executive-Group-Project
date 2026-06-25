"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { PushToDbDialog } from "@/app/(portal)/regulatory/consultations/[consultationId]/PushToDbDialog"

export function CreateChemskillButton() {
  const router = useRouter()
  return (
    <PushToDbDialog
      onSuccess={() => router.refresh()}
      trigger={
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1.5" />
          New Chemskill Chemical
        </Button>
      }
    />
  )
}
