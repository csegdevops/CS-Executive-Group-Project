import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"

// Service-role client: bypasses RLS. Server-only — never import in client components.
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!
  )
}
