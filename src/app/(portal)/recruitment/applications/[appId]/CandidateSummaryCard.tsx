import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { MapPin, Mail, Phone, Shield } from "lucide-react"

export interface CandidateSummary {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  current_title: string | null
  current_employer: string | null
  location_city: string | null
  location_state: string | null
  skills_tags: string[] | null
  security_clearance_level: string | null
  security_clearance_verified: boolean | null
}

export function CandidateSummaryCard({ candidate, hideSkills }: { candidate: CandidateSummary | null; hideSkills?: boolean }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h2 className="text-lg font-semibold">
            {candidate ? `${candidate.first_name} ${candidate.last_name}` : "Unknown"}
          </h2>
          {candidate?.current_title && <p className="text-sm text-muted-foreground">{candidate.current_title}</p>}
          {candidate?.current_employer && <p className="text-sm text-muted-foreground">{candidate.current_employer}</p>}
        </div>
        {candidate && (
          <Link href={`/recruitment/candidates/${candidate.id}`} className="text-xs text-primary hover:underline">
            View profile
          </Link>
        )}
      </div>
      <div className="space-y-1">
        {candidate?.email && (
          <a href={`mailto:${candidate.email}`} className="flex items-center gap-2 text-sm hover:text-primary">
            <Mail className="h-3.5 w-3.5 text-muted-foreground" />{candidate.email}
          </a>
        )}
        {candidate?.phone && (
          <a href={`tel:${candidate.phone}`} className="flex items-center gap-2 text-sm hover:text-primary">
            <Phone className="h-3.5 w-3.5 text-muted-foreground" />{candidate.phone}
          </a>
        )}
        {(candidate?.location_city || candidate?.location_state) && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            {[candidate.location_city, candidate.location_state].filter(Boolean).join(", ")}
          </p>
        )}
        {candidate?.security_clearance_level && (
          <p className="flex items-center gap-2 text-sm">
            <Shield className="h-3.5 w-3.5 text-amber-500" />
            {candidate.security_clearance_level}
            {candidate.security_clearance_verified && " ✓"}
          </p>
        )}
      </div>
      {!hideSkills && candidate?.skills_tags && candidate.skills_tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {candidate.skills_tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">{tag.replace(/_/g, " ")}</Badge>
          ))}
        </div>
      )}
    </div>
  )
}
