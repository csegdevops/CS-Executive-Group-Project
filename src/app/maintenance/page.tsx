import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BrandHeader } from "@/components/layout/BrandHeader"
import { Wrench } from "lucide-react"

export default function MaintenancePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <BrandHeader height={48} />
        </div>
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
              <Wrench className="h-6 w-6 text-amber-600" />
            </div>
            <CardTitle>Down for maintenance</CardTitle>
            <CardDescription>
              The portal is temporarily unavailable while we make some changes. Please check back shortly.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-center text-sm text-muted-foreground">
              Staff with access during maintenance can{" "}
              <Link href="/login" className="underline underline-offset-2 hover:text-foreground">
                sign in here
              </Link>
              .
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
