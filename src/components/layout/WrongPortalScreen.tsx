"use client"

import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BrandHeader } from "@/components/layout/BrandHeader"

// Shown instead of the internal Sidebar/portal chrome when a contractor or
// supervisor account (see profiles.user_type) somehow authenticates against
// the main portal login rather than the timesheets-portal subdomain. A plain
// redirect risks a loop with proxy.ts's "authenticated + on /login -> /home"
// rule, so this renders a terminal screen with an explicit sign-out instead.
export function WrongPortalScreen() {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <BrandHeader height={48} />
        </div>
        <Card>
          <CardHeader className="text-center">
            <CardTitle>Wrong portal</CardTitle>
            <CardDescription>This login is for internal staff only.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4 text-center">
              Contractors and supervisors sign in through the Timesheets Portal.
            </p>
            <Button className="w-full" onClick={handleSignOut}>Sign out</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
