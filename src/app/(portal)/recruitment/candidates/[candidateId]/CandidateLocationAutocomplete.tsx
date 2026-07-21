"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export interface CandidateLocation {
  city: string
  state: string
  postcode: string
}

interface Suggestion {
  place_id: string
  description: string
  parsed?: {
    suburb: string
    state: string
    postcode: string
  }
}

interface Props {
  value: CandidateLocation
  onChange: (fields: CandidateLocation) => void
}

// Candidates only need city/state/postcode (no street address) — a lighter
// counterpart to components/ui/AddressAutocomplete, which is built for full
// company addresses. Reuses the same /api/address search+detail endpoints.
export function CandidateLocationAutocomplete({ value, onChange }: Props) {
  const [query, setQuery]             = useState(value.city)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen]               = useState(false)
  const [loading, setLoading]         = useState(false)
  const debounce    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

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
    onChange({ ...value, city: q })

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

    if (s.parsed) {
      setQuery(s.parsed.suburb || s.description)
      onChange({ city: s.parsed.suburb, state: s.parsed.state, postcode: s.parsed.postcode })
      return
    }

    setQuery(s.description)
    try {
      const res = await fetch(`/api/address/detail?place_id=${encodeURIComponent(s.place_id)}`)
      if (!res.ok) return
      const detail = await res.json()
      const city = detail.suburb || s.description
      setQuery(city)
      onChange({ city, state: detail.state || "", postcode: detail.postcode || "" })
    } catch {
      onChange({ ...value, city: s.description })
    }
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      <div className="col-span-1 space-y-1.5" ref={containerRef}>
        <Label>City</Label>
        <div className="relative">
          <Input
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            placeholder="e.g. Canberra"
            autoComplete="off"
          />
          {loading && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">…</span>
          )}
          {open && suggestions.length > 0 && (
            <div className="absolute z-50 top-full mt-1 w-72 bg-popover border border-border rounded-md shadow-md overflow-hidden">
              {suggestions.map((s) => (
                <button
                  key={s.place_id}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                  onMouseDown={(e) => { e.preventDefault(); selectSuggestion(s) }}
                >
                  {s.description}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>State</Label>
        <Input
          value={value.state}
          onChange={(e) => onChange({ ...value, state: e.target.value })}
          placeholder="ACT"
          className="uppercase"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Postcode</Label>
        <Input
          value={value.postcode}
          onChange={(e) => onChange({ ...value, postcode: e.target.value })}
          placeholder="2600"
        />
      </div>
    </div>
  )
}
