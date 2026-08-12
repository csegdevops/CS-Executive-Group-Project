export interface ViewerEntry {
  id: string
  name: string | null
  viewed_at: string
}

export function ViewedBySection({ viewers }: { viewers: ViewerEntry[] }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="font-medium text-sm mb-2">Viewed by</h3>
      {viewers.length === 0 ? (
        <p className="text-xs text-muted-foreground">Not yet viewed by anyone.</p>
      ) : (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {viewers.map((v) => (
            <p key={v.id} className="text-xs text-muted-foreground">
              <span className="text-foreground font-medium">{v.name ?? "Unknown"}</span>
              {" · "}
              {new Date(v.viewed_at).toLocaleString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
