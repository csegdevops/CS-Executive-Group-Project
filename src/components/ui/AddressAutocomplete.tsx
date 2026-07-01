"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { AddressFields } from "@/lib/address"

export type { AddressFields }

interface Props {
  value: AddressFields
  onChange: (fields: AddressFields) => void
}

interface Suggestion {
  place_id:    string
  description: string
  parsed?: {
    address_line1: string
    suburb:  string
    state:   string
    postcode: string
    country: string
  }
}

export function AddressAutocomplete({ value, onChange }: Props) {
  const [query, setQuery]           = useState(value.address_line1)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen]             = useState(false)
  const [loading, setLoading]       = useState(false)
  const debounce                    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef                = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  function handleQueryChange(q: string) {
    setQuery(q)
    // Also update address_line1 directly so manual entry still works
    onChange({ ...value, address_line1: q })

    if (debounce.current) clearTimeout(debounce.current)
    if (q.length < 3) { setSuggestions([]); setOpen(false); return }

    debounce.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/address/search?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          setSuggestions(data)
          setOpen(true)
        } else {
          setSuggestions([])
          setOpen(false)
        }
      } finally {
        setLoading(false)
      }
    }, 300)
  }

  async function selectSuggestion(s: Suggestion) {
    setOpen(false)
    setSuggestions([])

    // Nominatim results already include parsed data — no second API call needed
    if (s.parsed) {
      setQuery(s.parsed.address_line1 || s.description)
      onChange({
        address_line1: s.parsed.address_line1,
        address_line2: value.address_line2,
        suburb:        s.parsed.suburb,
        state:         s.parsed.state,
        postcode:      s.parsed.postcode,
        country:       s.parsed.country || "Australia",
      })
      return
    }

    // Google Places — need a detail call to get address_components
    setQuery(s.description)
    try {
      const res = await fetch(`/api/address/detail?place_id=${encodeURIComponent(s.place_id)}`)
      if (!res.ok) return
      const detail = await res.json()
      setQuery(detail.address_line1 || s.description)
      onChange({
        address_line1: detail.address_line1 || s.description,
        address_line2: value.address_line2,
        suburb:        detail.suburb   || "",
        state:         detail.state    || "",
        postcode:      detail.postcode || "",
        country:       detail.country  || "Australia",
      })
    } catch {
      onChange({ ...value, address_line1: s.description })
    }
  }

  function field(k: keyof AddressFields, v: string) {
    onChange({ ...value, [k]: v })
  }

  return (
    <div className="space-y-3">
      {/* Address line 1 — autocomplete */}
      <div className="space-y-1.5" ref={containerRef}>
        <Label>Street address</Label>
        <div className="relative">
          <Input
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            placeholder="Start typing an address…"
            autoComplete="off"
          />
          {loading && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Searching…</span>
          )}
          {open && suggestions.length > 0 && (
            <div className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-md shadow-md overflow-hidden">
              {suggestions.map(s => (
                <button
                  key={s.place_id}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                  onMouseDown={e => { e.preventDefault(); selectSuggestion(s) }}
                >
                  {s.description}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Address line 2 */}
      <div className="space-y-1.5">
        <Label>Address line 2 <span className="text-muted-foreground text-xs">(optional)</span></Label>
        <Input
          value={value.address_line2}
          onChange={e => field("address_line2", e.target.value)}
          placeholder="Suite, Level, Unit…"
        />
      </div>

      {/* Suburb / State / Postcode */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-1 space-y-1.5">
          <Label>Suburb</Label>
          <Input value={value.suburb} onChange={e => field("suburb", e.target.value)} placeholder="Canberra" />
        </div>
        <div className="space-y-1.5">
          <Label>State</Label>
          <Input value={value.state} onChange={e => field("state", e.target.value)} placeholder="ACT" className="uppercase" />
        </div>
        <div className="space-y-1.5">
          <Label>Postcode</Label>
          <Input value={value.postcode} onChange={e => field("postcode", e.target.value)} placeholder="2600" />
        </div>
      </div>

      {/* Country */}
      <div className="space-y-1.5">
        <Label>Country</Label>
        <Input value={value.country} onChange={e => field("country", e.target.value)} placeholder="Australia" />
      </div>
    </div>
  )
}

// Re-export the pure utilities so existing imports from this path keep working.
export { emptyAddress, formatAddress, addressIsEmpty } from "@/lib/address"
