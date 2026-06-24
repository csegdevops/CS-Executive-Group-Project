"use client"

import { useState, useEffect, useCallback, Fragment } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2, Pencil, Check, X, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"

interface ConsultationProduct {
  id: string
  product_name: string
  units_per_year: number | null
  unit_size_grams: number | null
}

interface ChemicalRow {
  consultation_chemical_id: string
  chemical_id: string
  chemical_name: string
  cas_number: string | null
  product_name: string | null
  concentration: number | null
  aicis_conditions?: string | null
}

interface Props {
  consultationId: string
  initialProducts: ConsultationProduct[]
  chemicals: ChemicalRow[]
}

function aicisCategory(kg: number): { label: string; className: string } {
  if (kg < 0.1)   return { label: "Exempted",  className: "text-green-700 bg-green-50 border-green-200" }
  if (kg < 10000) return { label: "Reported",  className: "text-blue-700 bg-blue-50 border-blue-200" }
  return              { label: "Assessed",  className: "text-red-700 bg-red-50 border-red-200" }
}

function fmtKg(kg: number): string {
  if (kg < 0.001) return `${(kg * 1000).toFixed(2)} g`
  if (kg < 1)     return `${kg.toFixed(3)} kg`
  if (kg < 1000)  return `${kg.toFixed(2)} kg`
  return `${(kg / 1000).toFixed(2)} t`
}

interface EditingProduct {
  units_per_year: string
  unit_size_grams: string
}

export function VolumesTab({ consultationId, initialProducts, chemicals }: Props) {
  const router = useRouter()
  const [products, setProducts]     = useState<ConsultationProduct[]>(initialProducts)
  const [editing, setEditing]       = useState<Record<string, EditingProduct>>({})
  const [saving, setSaving]         = useState<Record<string, boolean>>({})
  const [deleting, setDeleting]         = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [cumulative, setCumulative] = useState<Record<string, number>>({})
  const [cumulativeLoading, setCumulativeLoading] = useState(false)

  const loadCumulative = useCallback(async () => {
    setCumulativeLoading(true)
    try {
      const res = await fetch(`/api/consultations/${consultationId}/products`)
      if (res.ok) {
        const json = await res.json() as { products: ConsultationProduct[]; cumulative: Record<string, number> }
        setProducts(json.products)
        setCumulative(json.cumulative)
      }
    } catch {
      // non-fatal — cumulative is supplementary info
    } finally {
      setCumulativeLoading(false)
    }
  }, [consultationId])

  useEffect(() => {
    loadCumulative()
  }, [loadCumulative])

  function startEdit(product: ConsultationProduct) {
    setEditing((prev) => ({
      ...prev,
      [product.product_name]: {
        units_per_year:  product.units_per_year?.toString()  ?? "",
        unit_size_grams: product.unit_size_grams?.toString() ?? "",
      },
    }))
  }

  async function handleDeleteProduct(productName: string) {
    setDeleting(productName)
    try {
      const res = await fetch(
        `/api/consultations/${consultationId}/products?product_name=${encodeURIComponent(productName)}`,
        { method: "DELETE" }
      )
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Delete failed" }))
        toast.error(err.error ?? "Delete failed")
        return
      }
      setProducts((prev) => prev.filter((p) => p.product_name !== productName))
      await loadCumulative()
      router.refresh()
      toast.success(`"${productName}" and its ingredients removed`)
    } catch {
      toast.error("Network error")
    } finally {
      setDeleting(null)
    }
  }

  function cancelEdit(productName: string) {
    setEditing((prev) => {
      const next = { ...prev }
      delete next[productName]
      return next
    })
  }

  async function saveEdit(productName: string) {
    const vals = editing[productName]
    if (!vals) return

    const units = vals.units_per_year  ? parseFloat(vals.units_per_year)  : null
    const size  = vals.unit_size_grams ? parseFloat(vals.unit_size_grams) : null

    if (vals.units_per_year && (isNaN(units!) || units! <= 0)) {
      toast.error("Units per year must be a positive number")
      return
    }
    if (vals.unit_size_grams && (isNaN(size!) || size! <= 0)) {
      toast.error("Unit size must be a positive number")
      return
    }

    setSaving((prev) => ({ ...prev, [productName]: true }))
    try {
      const res = await fetch(`/api/consultations/${consultationId}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_name: productName, units_per_year: units, unit_size_grams: size }),
      })
      if (!res.ok) {
        const err = await res.json()
        toast.error(err.error ?? "Failed to save")
        return
      }
      const updated = await res.json() as ConsultationProduct
      setProducts((prev) => prev.map((p) => p.product_name === productName ? updated : p))
      cancelEdit(productName)
      // Refresh cumulative after saving volume data
      await loadCumulative()
    } catch {
      toast.error("Network error")
    } finally {
      setSaving((prev) => ({ ...prev, [productName]: false }))
    }
  }

  // Compute annual volumes for THIS consultation's chemicals from current product inputs
  const productMap = new Map(products.map((p) => [p.product_name, p]))

  const chemicalVolumes: Array<{
    chemical_id: string
    chemical_name: string
    cas_number: string | null
    product_name: string | null
    concentration: number | null
    aicis_conditions?: string | null
    annualKg: number | null
  }> = chemicals.map((chem) => {
    const prod = chem.product_name ? productMap.get(chem.product_name) : undefined
    const annualKg =
      prod?.units_per_year && prod?.unit_size_grams && chem.concentration
        ? (prod.units_per_year * prod.unit_size_grams * chem.concentration / 100) / 1000
        : null
    return { ...chem, annualKg }
  })

  return (
    <div className="space-y-8">

      {/* ── Product volume inputs ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Product Volumes</h3>
          <Button variant="ghost" size="sm" onClick={loadCumulative} disabled={cumulativeLoading}>
            {cumulativeLoading
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <RefreshCw className="h-3.5 w-3.5" />}
          </Button>
        </div>

        {products.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No products yet. Upload a formulation on the Chemicals tab to create product entries.
          </p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Product</th>
                  <th className="text-left px-4 py-2.5 font-medium">Units/Year</th>
                  <th className="text-left px-4 py-2.5 font-medium">Unit Size (g)</th>
                  <th className="px-4 py-2.5 w-24" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {products.map((prod) => {
                  const isEditing = Boolean(editing[prod.product_name])
                  const isSaving  = Boolean(saving[prod.product_name])
                  const vals      = editing[prod.product_name]
                  return (
                    <tr key={prod.product_name} className="hover:bg-muted/20">
                      <td className="px-4 py-2.5 font-medium">{prod.product_name}</td>
                      <td className="px-4 py-2.5">
                        {isEditing ? (
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={vals.units_per_year}
                            onChange={(e) => setEditing((prev) => ({
                              ...prev,
                              [prod.product_name]: { ...prev[prod.product_name], units_per_year: e.target.value },
                            }))}
                            className="h-7 w-28 text-sm"
                            placeholder="e.g. 5000"
                          />
                        ) : (
                          <span className="tabular-nums">
                            {prod.units_per_year !== null ? prod.units_per_year.toLocaleString() : <span className="text-muted-foreground">—</span>}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        {isEditing ? (
                          <Input
                            type="number"
                            min="0"
                            step="0.1"
                            value={vals.unit_size_grams}
                            onChange={(e) => setEditing((prev) => ({
                              ...prev,
                              [prod.product_name]: { ...prev[prod.product_name], unit_size_grams: e.target.value },
                            }))}
                            className="h-7 w-28 text-sm"
                            placeholder="e.g. 50"
                          />
                        ) : (
                          <span className="tabular-nums">
                            {prod.unit_size_grams !== null ? `${prod.unit_size_grams} g` : <span className="text-muted-foreground">—</span>}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-1 justify-end">
                          {isEditing ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-green-700"
                                onClick={() => saveEdit(prod.product_name)}
                                disabled={isSaving}
                              >
                                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground"
                                onClick={() => cancelEdit(prod.product_name)}
                                disabled={isSaving}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          ) : confirmDelete === prod.product_name ? (
                            <>
                              <span className="text-xs text-destructive mr-1">Delete?</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive"
                                onClick={() => { setConfirmDelete(null); handleDeleteProduct(prod.product_name) }}
                                disabled={deleting === prod.product_name}
                              >
                                {deleting === prod.product_name
                                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  : <Check className="h-3.5 w-3.5" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground"
                                onClick={() => setConfirmDelete(null)}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground"
                                onClick={() => startEdit(prod)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => setConfirmDelete(prod.product_name)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Per-ingredient import volumes ── */}
      {chemicalVolumes.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold mb-3">Import Volume Per Ingredient</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Annual volume = (units/year × unit size × concentration %) ÷ 1,000 kg.
            Cumulative includes all products across this company&apos;s consultations.
          </p>
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">Ingredient</th>
                  <th className="text-left px-4 py-2.5 font-medium">CAS</th>
                  <th className="text-right px-4 py-2.5 font-medium">Conc %</th>
                  <th className="text-right px-4 py-2.5 font-medium">This product (kg/yr)</th>
                  <th className="text-right px-4 py-2.5 font-medium">Cumulative (all products)</th>
                  <th className="text-left px-4 py-2.5 font-medium">Category</th>
                  <th className="text-left px-4 py-2.5 font-medium">AICIS Conditions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {Object.entries(
                  chemicalVolumes.reduce<Record<string, typeof chemicalVolumes>>((acc, row) => {
                    const key = row.product_name ?? "(no product)"
                    ;(acc[key] ??= []).push(row)
                    return acc
                  }, {})
                ).map(([productName, rows]) => {
                  const subtotalKg = rows.reduce((sum, r) => sum + (r.annualKg ?? 0), 0)
                  const hasVolumes = rows.some((r) => r.annualKg !== null)
                  return (
                    <Fragment key={productName}>
                      <tr className="bg-muted/40 border-t">
                        <td colSpan={7} className="px-4 py-2 text-xs font-semibold text-muted-foreground">
                          {productName}
                          {hasVolumes && (
                            <span className="font-mono font-normal text-foreground ml-3">
                              sub-total: {fmtKg(subtotalKg)}/yr
                            </span>
                          )}
                        </td>
                      </tr>
                      {rows.map((chem, i) => {
                        const cumulKg = cumulative[chem.chemical_id] ?? null
                        const cat     = cumulKg !== null ? aicisCategory(cumulKg) : null
                        const cond    = chem.aicis_conditions ?? null
                        return (
                          <tr key={i} className="hover:bg-muted/20">
                            <td className="px-4 py-2.5">
                              <span className="font-medium truncate max-w-[200px] block" title={chem.chemical_name}>
                                {chem.chemical_name}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 font-mono text-xs">{chem.cas_number ?? "—"}</td>
                            <td className="px-4 py-2.5 tabular-nums text-right">
                              {chem.concentration !== null ? `${chem.concentration}%` : "—"}
                            </td>
                            <td className="px-4 py-2.5 tabular-nums text-right">
                              {chem.annualKg !== null
                                ? <span className="font-mono">{fmtKg(chem.annualKg)}</span>
                                : <span className="text-muted-foreground text-xs">Enter volumes above</span>}
                            </td>
                            <td className="px-4 py-2.5 tabular-nums text-right">
                              {cumulativeLoading ? (
                                <Loader2 className="h-3 w-3 animate-spin inline" />
                              ) : cumulKg !== null ? (
                                <span className="font-mono">{fmtKg(cumulKg)}</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              {cat ? (
                                <Badge variant="outline" className={`text-xs ${cat.className}`}>
                                  {cat.label}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 max-w-[220px]">
                              {cond ? (
                                <span
                                  className="text-xs text-muted-foreground truncate block cursor-help"
                                  title={cond}
                                >
                                  {cond.length > 45 ? `${cond.slice(0, 45)}…` : cond}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}
