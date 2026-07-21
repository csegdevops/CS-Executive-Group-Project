import { Resend } from "resend"

// Server-only — never import in client components. Requires RESEND_API_KEY.
export function createResendClient() {
  return new Resend(process.env.RESEND_API_KEY!)
}

export const EMAIL_FROM = "CS Executive Group Portal <noreply@csexecgroup.com>"
