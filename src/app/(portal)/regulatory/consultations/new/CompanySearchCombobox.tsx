"use client"

import { useEffect, useRef, useState } from "react"
import { Input } from "@/components/ui/input"

interface Company { id: string; name: string; country: string | null }

interface Props {
  companies: Company[]
  value: string
  onChange: (id: string) => void
}

export function CompanySearchCombobox({ companies, value, onChange }: Props) {
  const selected = companies.find((c) => c.id === value) ?? null
  const [query, setQuery] = useState(selected?.name ?? "")
  const [open, setOpen]   = useState(false)
  const containerRef      = useRef<HTMLDivElement>(null)

  // Keep the input text in sync when the selected company changes externally
  // (e.g. ?company_id= prefill resolving once `companies` loads).
  useEffect(() => {
    setQuery(selected?.name ?? "")
  }, [selected?.name])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        // Revert to the last valid selection if the user typed something
        // and clicked away without picking a suggestion.
        setQuery(selected?.name ?? "")
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [selected?.name])

  const q = query.trim().toLowerCase()
  const matches = q.length === 0
    ? companies
    : companies.filter((c) =>
        c.name.toLowerCase().includes(q) || (c.country ?? "").toLowerCase().includes(q)
      )

  function select(c: Company) {
    onChange(c.id)
    setQuery(c.name)
    setOpen(false)
  }

  return (
    <div className="relative" ref={containerRef}>
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          if (value) onChange("")
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search for a company…"
        autoComplete="off"
      />
      {open && (
        <div className="absolute z-50 top-full mt-1 w-full max-h-64 overflow-y-auto bg-popover border border-border rounded-md shadow-md">
          {matches.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">No companies found</div>
          ) : (
            matches.map((c) => (
              <button
                key={c.id}
                type="button"
                className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                onMouseDown={(e) => { e.preventDefault(); select(c) }}
              >
                {c.name}
                {c.country && <span className="text-muted-foreground"> ({c.country})</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
