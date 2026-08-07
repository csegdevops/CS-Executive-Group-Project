import { parsePhoneNumberFromString } from "libphonenumber-js"

// Returns the ISO-3166-1 alpha-2 country implied by a phone number's dialing
// prefix, or null if it can't be determined. "AU" is passed as the default
// region so a bare national-format AU number (e.g. "0412 345 678", no "+61")
// resolves to AU rather than being treated as unparseable/foreign — callers
// decide what to do with an "AU" result (this function doesn't know AU is
// the business's home country).
export function inferCountryFromPhone(phone: string | null | undefined): string | null {
  if (!phone) return null
  const parsed = parsePhoneNumberFromString(phone, "AU")
  // isPossible() (not isValid()) — AI-extracted numbers vary in formatting/
  // spacing and shouldn't be rejected by strict national-length validation;
  // worst case of a too-permissive check is simply "no country inferred",
  // same outcome as being unparseable.
  return parsed?.isPossible() ? (parsed.country ?? null) : null
}
