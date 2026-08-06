"use client"

import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { BrandHeader } from "@/components/layout/BrandHeader"
import { LogOut } from "lucide-react"

export function TimesheetsPortalHeader({ userName }: { userName: string | null }) {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <header className="border-b bg-background">
      <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
        <BrandHeader height={28} />
        <div className="flex items-center gap-3">
          {userName && <span className="text-sm text-muted-foreground">{userName}</span>}
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-1.5">
            <LogOut className="h-3.5 w-3.5" />Sign out
          </Button>
        </div>
      </div>
    </header>
  )
}
