"use client"

import { useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BrandHeader } from "@/components/layout/BrandHeader"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  // Only ever populated for the rate-limit case (see handleSubmit) — every
  // other failure still falls through to the generic "sent" message so
  // whether an email is actually registered is never revealed.
  const [rateLimitError, setRateLimitError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setRateLimitError(null)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) {
        console.error("[forgot-password]", error)
        // 429 is a request-frequency limit, not tied to whether the email
        // is registered — safe to surface without enabling enumeration.
        if (error.status === 429) {
          setRateLimitError(error.message)
          setLoading(false)
          return
        }
      }
    } catch (err) {
      console.error("[forgot-password]", err)
    }

    // Always show success for every other outcome — prevents email enumeration
    setSent(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <BrandHeader height={48} />
        </div>

        <Card>
          <CardHeader className="text-center">
            <CardTitle>Reset password</CardTitle>
            <CardDescription>
              Enter your email and we&apos;ll send a reset link
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="space-y-4">
                <div className="rounded-md bg-green-50 border border-green-200 px-3 py-3 text-sm text-green-800">
                  If that email is registered, a reset link has been sent. Check your inbox.
                </div>
                <Link href="/login">
                  <Button variant="outline" className="w-full">Back to sign in</Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@csexecgroup.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>

                {rateLimitError && (
                  <p className="text-sm text-destructive">{rateLimitError}</p>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Sending…" : "Send reset link"}
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  <Link href="/login" className="underline underline-offset-2 hover:text-foreground">
                    Back to sign in
                  </Link>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
