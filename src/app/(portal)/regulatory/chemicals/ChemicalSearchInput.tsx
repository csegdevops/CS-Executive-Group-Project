"use client"

import { useRouter, usePathname } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import { useTransition, useState, useEffect, useRef } from "react"

export function ChemicalSearchInput({ defaultValue }: { defaultValue: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const [, startTransition] = useTransition()
  const [value, setValue] = useState(defaultValue)
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    const t = setTimeout(() => {
      startTransition(() => {
        const params = new URLSearchParams()
        if (value) params.set("q", value)
        router.push(`${pathname}?${params.toString()}`)
      })
    }, 250)
    return () => clearTimeout(t)
  }, [value, pathname, router, startTransition])

  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        type="search"
        placeholder="Search by CAS, IUPAC name, or trade name…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="pl-9"
      />
    </div>
  )
}
