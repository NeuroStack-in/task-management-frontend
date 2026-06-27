"use client"

import { Minus, Plus } from "lucide-react"

import { cn } from "@/lib/utils"

interface NumberStepperProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
  disabled?: boolean
  /** Width of the centered value area (Tailwind class). */
  valueWidthClassName?: string
}

/**
 * Compact numeric input with − / + steppers and an optional unit suffix.
 * The value + unit are vertically and horizontally centered as one group.
 */
export function NumberStepper({
  value,
  onChange,
  min,
  max,
  step = 1,
  suffix,
  disabled,
  valueWidthClassName = "w-20",
}: NumberStepperProps) {
  const lo = min ?? Number.NEGATIVE_INFINITY
  const hi = max ?? Number.POSITIVE_INFINITY
  const clamp = (n: number) => Math.min(hi, Math.max(lo, n))

  return (
    <div
      className={cn(
        "inline-flex h-9 shrink-0 items-center overflow-hidden rounded-md border bg-background transition-colors focus-within:ring-2 focus-within:ring-ring/40",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled || value <= lo}
        onClick={() => onChange(clamp(value - step))}
        aria-label="Decrease"
        className="flex h-full w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
      >
        <Minus className="size-3.5" />
      </button>
      <div
        className={cn(
          "flex h-full items-center justify-center gap-1 border-x px-1",
          valueWidthClassName,
        )}
      >
        <input
          type="number"
          inputMode="numeric"
          value={value}
          min={min}
          max={max}
          disabled={disabled}
          onChange={(e) => {
            if (e.target.value === "") return
            onChange(clamp(Number(e.target.value)))
          }}
          className={cn(
            "w-8 [appearance:textfield] bg-transparent text-sm tabular-nums outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
            suffix ? "text-right" : "text-center",
          )}
        />
        {suffix && (
          <span className="select-none text-xs text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled || value >= hi}
        onClick={() => onChange(clamp(value + step))}
        aria-label="Increase"
        className="flex h-full w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  )
}
