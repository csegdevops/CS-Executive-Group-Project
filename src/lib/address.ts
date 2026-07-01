export interface AddressFields {
  address_line1: string
  address_line2: string
  suburb:        string
  state:         string
  postcode:      string
  country:       string
}

export const emptyAddress: AddressFields = {
  address_line1: "",
  address_line2: "",
  suburb:        "",
  state:         "",
  postcode:      "",
  country:       "Australia",
}

export function formatAddress(a: Partial<AddressFields>): string {
  return [a.address_line1, a.address_line2, a.suburb, a.state, a.postcode, a.country]
    .filter(Boolean).join(", ")
}

export function addressIsEmpty(a: AddressFields): boolean {
  return !a.address_line1 && !a.suburb && !a.postcode
}
