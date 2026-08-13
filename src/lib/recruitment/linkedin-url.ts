// Some intake forms (WordPress/Gravity Forms) pre-fill a LinkedIn field with
// a placeholder like "https://www.linkedin.com/" that gets submitted as-is
// whenever a candidate leaves it untouched — indistinguishable from real
// data unless we require an actual profile path, not just a non-empty
// string. A bare/default linkedin.com URL is treated as no URL at all.
export function isLinkedinProfileUrl(url: string): boolean {
  try {
    const u = new URL(url)
    if (!/(^|\.)linkedin\.com$/i.test(u.hostname)) return false
    return u.pathname.replace(/\/+$/, "").length > 0
  } catch {
    return false
  }
}
