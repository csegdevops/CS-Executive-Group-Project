"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ChevronLeft } from "lucide-react"

export function BackButton({ href, label }: { href: string; label: string }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-2 text-muted-foreground hover:text-foreground"
      asChild
    >
      <Link href={href}>
        <ChevronLeft className="h-4 w-4 mr-1" />
        {label}
      </Link>
    </Button>
  )
}
