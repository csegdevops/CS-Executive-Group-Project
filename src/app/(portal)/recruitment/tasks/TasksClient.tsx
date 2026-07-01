"use client"

import { useState, useOptimistic } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { CheckCircle2, Circle, AlertCircle, FileText, DollarSign, Shield, ListTodo } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

const TYPE_ICONS: Record<string, React.ElementType> = {
  finance_contract:   FileText,
  finance_invoice:    DollarSign,
  security_clearance: Shield,
  general:            ListTodo,
}

const TYPE_LABELS: Record<string, string> = {
  finance_contract:   "Contract",
  finance_invoice:    "Invoice",
  security_clearance: "Security Clearance",
  general:            "General",
}

const TYPE_COLORS: Record<string, string> = {
  finance_contract:   "text-blue-500",
  finance_invoice:    "text-purple-500",
  security_clearance: "text-amber-500",
  general:            "text-muted-foreground",
}

const STATUS_COLORS: Record<string, string> = {
  open:        "text-muted-foreground",
  in_progress: "text-blue-500",
  completed:   "text-green-500",
}

interface Task {
  id: string
  task_type: string
  title: string
  description: string | null
  status: string
  assigned_to: string | null
  assigned_to_name: string | null
  due_date: string | null
  completed_at: string | null
  candidate_name: string | null
  job_title: string | null
  job_reference: string | null
  candidate_id: string | null
  job_id: string | null
  created_at: string
}

interface Props {
  tasks: Task[]
  profiles: { id: string; name: string }[]
  currentUserId: string
}

export function TasksClient({ tasks: initialTasks, profiles, currentUserId }: Props) {
  const router = useRouter()
  const [tasks, setTasks] = useState(initialTasks)
  const [filter, setFilter] = useState<"all" | "mine" | "open">("open")

  const filtered = tasks.filter(t => {
    if (filter === "mine")  return t.assigned_to === currentUserId
    if (filter === "open")  return t.status !== "completed"
    return true
  })

  // Group by type
  const byType: Record<string, Task[]> = {}
  for (const t of filtered) {
    if (!byType[t.task_type]) byType[t.task_type] = []
    byType[t.task_type].push(t)
  }

  async function toggleStatus(task: Task) {
    const next = task.status === "completed" ? "open" : "completed"
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: next } : t))
    const res = await fetch(`/api/recruitment/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    })
    if (!res.ok) {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: task.status } : t))
      toast.error("Failed to update task")
    } else {
      toast.success(next === "completed" ? "Task completed" : "Reopened")
      router.refresh()
    }
  }

  async function assignToMe(task: Task) {
    const res = await fetch(`/api/recruitment/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assigned_to: currentUserId }),
    })
    if (!res.ok) { toast.error("Failed to assign"); return }
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, assigned_to: currentUserId } : t))
    toast.success("Assigned to you")
  }

  const openCount = tasks.filter(t => t.status !== "completed").length

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex gap-1 mb-5">
        {([["open", `Open (${openCount})`], ["mine", "Assigned to me"], ["all", "All"]] as const).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            className={cn(
              "px-3 py-1.5 text-sm rounded-md transition-colors",
              filter === val ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-sm text-muted-foreground border rounded-lg">
          {filter === "mine" ? "No tasks assigned to you." : "No tasks."}
        </div>
      )}

      <div className="space-y-6">
        {Object.entries(byType).map(([type, typeTasks]) => {
          const Icon = TYPE_ICONS[type] ?? ListTodo
          return (
            <div key={type}>
              <div className="flex items-center gap-2 mb-2">
                <Icon className={cn("h-4 w-4", TYPE_COLORS[type])} />
                <h2 className="text-sm font-semibold">{TYPE_LABELS[type] ?? type}</h2>
                <span className="text-xs text-muted-foreground">({typeTasks.length})</span>
              </div>
              <div className="rounded-lg border divide-y overflow-hidden">
                {typeTasks.map(task => (
                  <div key={task.id} className={cn("flex items-start gap-3 px-4 py-3 hover:bg-muted/20 transition-colors", task.status === "completed" && "opacity-50")}>
                    <button onClick={() => toggleStatus(task)} className="mt-0.5 shrink-0" title={task.status === "completed" ? "Reopen" : "Mark complete"}>
                      {task.status === "completed"
                        ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                        : task.status === "in_progress"
                        ? <AlertCircle className="h-4 w-4 text-blue-500" />
                        : <Circle className="h-4 w-4 text-muted-foreground/40 hover:text-foreground/60" />
                      }
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-medium", task.status === "completed" && "line-through")}>{task.title}</p>
                      <div className="flex flex-wrap items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                        {task.candidate_name && task.candidate_id && (
                          <Link href={`/recruitment/candidates/${task.candidate_id}`} className="hover:underline">
                            {task.candidate_name}
                          </Link>
                        )}
                        {task.job_title && task.job_id && (
                          <Link href={`/recruitment/jobs/${task.job_id}`} className="hover:underline">
                            {task.job_reference ?? task.job_title}
                          </Link>
                        )}
                        {task.due_date && (
                          <span className={cn(new Date(task.due_date) < new Date() && task.status !== "completed" ? "text-red-500" : "")}>
                            Due {new Date(task.due_date).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {task.assigned_to_name ? (
                        <span className="text-xs text-muted-foreground">{task.assigned_to_name}</span>
                      ) : (
                        <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => assignToMe(task)}>
                          Assign to me
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
