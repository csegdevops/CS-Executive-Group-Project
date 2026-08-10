"use client"

import { useEffect, useState } from "react"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Radix SelectItem rejects an empty string value.
const NONE = "_none_"

interface LookupValue { value: string; label: string }

export function AwardFields({
  award, awardLevel, onAwardChange, onAwardLevelChange,
}: {
  award: string
  awardLevel: string
  onAwardChange: (v: string) => void
  onAwardLevelChange: (v: string) => void
}) {
  const [awards, setAwards] = useState<LookupValue[]>([])
  const [levels, setLevels] = useState<LookupValue[]>([])

  useEffect(() => {
    fetch("/api/lookup-values?scope=recruitment&category=award")
      .then((r) => r.json())
      .then((d) => setAwards(Array.isArray(d) ? d : []))
      .catch(() => {})
    fetch("/api/lookup-values?scope=recruitment&category=award_level")
      .then((r) => r.json())
      .then((d) => setLevels(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])

  return (
    <>
      <div className="space-y-1.5">
        <Label>Award</Label>
        <Select value={award || NONE} onValueChange={(v) => onAwardChange(v === NONE ? "" : v)}>
          <SelectTrigger><SelectValue placeholder="Not set" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Not set</SelectItem>
            {awards.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Award level</Label>
        <Select value={awardLevel || NONE} onValueChange={(v) => onAwardLevelChange(v === NONE ? "" : v)}>
          <SelectTrigger><SelectValue placeholder="Not set" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Not set</SelectItem>
            {levels.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </>
  )
}
