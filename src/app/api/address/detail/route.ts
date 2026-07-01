import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const PLACES_API_KEY = process.env.GOOGLE_MAPS_API_KEY

interface AddressComponent {
  long_name:  string
  short_name: string
  types:      string[]
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const placeId = req.nextUrl.searchParams.get("place_id")
  if (!placeId) return NextResponse.json({ error: "place_id required" }, { status: 400 })
  if (!PLACES_API_KEY) return NextResponse.json({ error: "Not configured" }, { status: 503 })

  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json")
  url.searchParams.set("place_id", placeId)
  url.searchParams.set("fields", "address_components")
  url.searchParams.set("key", PLACES_API_KEY)

  const res = await fetch(url.toString(), { next: { revalidate: 3600 } })
  if (!res.ok) return NextResponse.json({ error: "Places API error" }, { status: 500 })

  const json = await res.json()
  const components: AddressComponent[] = json.result?.address_components ?? []

  function get(type: string, short = false) {
    const c = components.find(c => c.types.includes(type))
    return c ? (short ? c.short_name : c.long_name) : ""
  }

  const streetNumber = get("street_number")
  const route        = get("route")
  const address_line1 = [streetNumber, route].filter(Boolean).join(" ")
  const suburb        = get("locality") || get("sublocality") || get("sublocality_level_1")
  const state         = get("administrative_area_level_1", true)  // VIC, NSW, etc.
  const postcode      = get("postal_code")
  const country       = get("country")

  return NextResponse.json({ address_line1, suburb, state, postcode, country })
}
