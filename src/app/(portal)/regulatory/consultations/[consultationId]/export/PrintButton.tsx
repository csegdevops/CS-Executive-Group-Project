"use client"

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-sm hover:bg-muted transition-colors print:hidden"
    >
      Print / Save as PDF
    </button>
  )
}
