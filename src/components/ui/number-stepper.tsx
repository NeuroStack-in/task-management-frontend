"use client"

import { useState } from "react"
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
  /** The field's accessible name — the stepper has no visible label of its own. */
  "aria-label"?: string
  id?: string
}

/**
 * Compact **whole-number** input with − / + steppers and an optional unit suffix.
 * The value + unit are vertically and horizontally centered as one group.
 *
 * Typing edits a local draft; the value is clamped only when the field is left (or Enter is
 * pressed). It used to clamp on every keystroke and ignore an empty field, so clearing "30" to type
 * "45" produced 345, and it accepted decimals that the integer server fields then rejected (QA audit
 * 2026-10-08, WP-361). A valid in-range number is still reported as it is typed, so a form sees the
 * edit before the field loses focus.
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
  "aria-label": ariaLabel,
  id,
}: NumberStepperProps) {
  const lo = min ?? Number.NEGATIVE_INFINITY
  const hi = max ?? Number.POSITIVE_INFINITY
  const clamp = (n: number) => Math.min(hi, Math.max(lo, Math.round(n)))
  /** What the person is typing; `null` when the field shows the value itself. */
  const [draft, setDraft] = useState<string | null>(null)

  /** Leave the field: an empty or out-of-range entry snaps to the nearest allowed whole number. */
  const commit = () => {
    if (draft === null) return
    const n = Number.parseInt(draft, 10)
    if (Number.isFinite(n) && clamp(n) !== value) onChange(clamp(n))
    setDraft(null)
  }

  const stepBy = (delta: number) => {
    setDraft(null)
    onChange(clamp(value + delta))
  }

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
        onClick={() => stepBy(-step)}
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
        {/* A text input, not `type="number"`: that one accepts `e`, `.` and `-` and steps on its
            own. Digits only; arrows step by `step`, as the − / + buttons do. */}
        <input
          id={id}
          type="text"
          inputMode="numeric"
          role="spinbutton"
          aria-label={ariaLabel}
          aria-valuenow={value}
          aria-valuemin={min}
          aria-valuemax={max}
          value={draft ?? String(value)}
          disabled={disabled}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "")
            setDraft(digits)
            const n = Number.parseInt(digits, 10)
            if (Number.isFinite(n) && n >= lo && n <= hi) onChange(n)
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit()
            else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
              e.preventDefault()
              stepBy(e.key === "ArrowUp" ? step : -step)
            }
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
        onClick={() => stepBy(step)}
        aria-label="Increase"
        className="flex h-full w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  )
}
