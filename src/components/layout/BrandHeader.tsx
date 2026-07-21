import Image from "next/image"
import { Poppins } from "next/font/google"
import { cn } from "@/lib/utils"

// Bold geometric sans — matches the letterforms in the CS Executive Group
// wordmark artwork (cseg_logo_new.png).
const poppins = Poppins({ subsets: ["latin"], weight: ["700"] })

const ICON_SRC = "/CSEG_Logo_2.png"
const ICON_ASPECT = 153 / 170
const LINE_HEIGHT_RATIO = 1.25 // matches Tailwind's leading-tight

interface BrandHeaderProps {
  /** "full" shows the mark + "CS Executive / Group Portal" wordmark. "icon" shows just the mark. */
  variant?: "full" | "icon"
  height?: number
  className?: string
}

export function BrandHeader({ variant = "full", height = 32, className }: BrandHeaderProps) {
  const fontSize = Math.max(9, Math.round(height * 0.34))
  const textBlockHeight = fontSize * LINE_HEIGHT_RATIO * 2

  // Icon is sized to match the two-line text block's actual height, not the
  // raw `height` prop, so the mark and wordmark read as one unit.
  const iconHeight = variant === "full" ? textBlockHeight : height
  const iconWidth = iconHeight * ICON_ASPECT

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="relative shrink-0" style={{ height: iconHeight, width: iconWidth }}>
        <Image
          src={ICON_SRC}
          alt="CS Executive Group"
          fill
          priority
          sizes={`${Math.round(iconWidth)}px`}
          className="object-contain"
        />
      </div>
      {variant === "full" && (
        <div
          className={cn("flex flex-col leading-tight text-foreground uppercase tracking-wide", poppins.className)}
          style={{ fontSize }}
        >
          <span>CS Executive</span>
          <span>Group Portal</span>
        </div>
      )}
    </div>
  )
}
