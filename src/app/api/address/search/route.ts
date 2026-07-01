import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY

export interface AddressSuggestion {
  place_id:    string
  description: string
  // Nominatim results already include the parsed breakdown; Google Places needs
  // a second /detail call to get it.
  parsed?: {
    address_line1: string
    suburb:  string
    state:   string
    postcode: string
    country: string
  }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const q = req.nextUrl.searchParams.get("q")?.trim()
  if (!q || q.length < 3) return NextResponse.json([])

  if (GOOGLE_KEY) {
    return googleSearch(q)
  }
  return nominatimSearch(q)
}

// ── Google Places Autocomplete ─────────────────────────────────────────────────

async function googleSearch(q: string): Promise<Response> {
  const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json")
  url.searchParams.set("input", q)
  url.searchParams.set("components", "country:au")
  url.searchParams.set("types", "address")
  url.searchParams.set("key", GOOGLE_KEY!)

  const res = await fetch(url.toString(), { next: { revalidate: 60 } })
  if (!res.ok) return NextResponse.json([])

  const json = await res.json()
  const suggestions: AddressSuggestion[] = (json.predictions ?? []).slice(0, 6).map(
    (p: { place_id: string; description: string }) => ({
      place_id:    p.place_id,
      description: p.description,
      // No parsed data — client will call /api/address/detail
    })
  )
  return NextResponse.json(suggestions)
}

// ── OpenStreetMap Nominatim fallback (no API key required) ────────────────────

interface NominatimResult {
  place_id: number
  display_name: string
  address: {
    house_number?: string
    road?: string
    suburb?: string
    city_district?: string
    city?: string
    town?: string
    village?: string
    state?: string
    postcode?: string
    country?: string
    country_code?: string
  }
}

async function nominatimSearch(q: string): Promise<Response> {
  const url = new URL("https://nominatim.openstreetmap.org/search")
  url.searchParams.set("q", q)
  url.searchParams.set("countrycodes", "au")
  url.searchParams.set("format", "jsonv2")
  url.searchParams.set("addressdetails", "1")
  url.searchParams.set("limit", "6")

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "CSExecutivePortal/1.0" },
    next: { revalidate: 60 },
  })
  if (!res.ok) return NextResponse.json([])

  const results: NominatimResult[] = await res.json()

  const suggestions: AddressSuggestion[] = results.map(r => {
    const a = r.address
    const streetNum = a.house_number ?? ""
    const road      = a.road        ?? ""
    const address_line1 = [streetNum, road].filter(Boolean).join(" ")
    const suburb    = a.suburb ?? a.city_district ?? a.city ?? a.town ?? a.village ?? ""
    const state     = abbreviateState(a.state ?? "")
    const postcode  = a.postcode ?? ""
    const country   = a.country  ?? "Australia"

    // Build a clean description (shorter than the full Nominatim display_name)
    const parts = [address_line1, suburb, state, postcode].filter(Boolean)
    const description = parts.length > 0 ? parts.join(", ") : r.display_name

    return {
      place_id:    String(r.place_id),
      description,
      parsed:      { address_line1, suburb, state, postcode, country },
    }
  })

  return NextResponse.json(suggestions)
}

function abbreviateState(full: string): string {
  const map: Record<string, string> = {
    "Australian Capital Territory": "ACT",
    "New South Wales":  "NSW",
    "Northern Territory": "NT",
    "Queensland":       "QLD",
    "South Australia":  "SA",
    "Tasmania":         "TAS",
    "Victoria":         "VIC",
    "Western Australia":"WA",
  }
  return map[full] ?? full
}
