"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Loader } from "@/components/shared/loader"
import { ApiError } from "@/lib/api"
import { readRoster, type ApiEmployee } from "@/modules/employees/services/employees.service"
import {
  getScreenshotExclusions,
  setScreenshotExclusions,
} from "../services/screenshot-exclusions.service"

/**
 * **Excluded from screenshots** — the people whose screenshots are never shown for review, sent for
 * AI analysis or summarised (Settings → Monitoring, `monitoring:manage`). The server's privacy gate
 * enforces it; this card only edits the list (owner decision 2026-10-09, QA audit WP-146).
 *
 * Saved on its own, not with the policy form above: it is a different document, and a list of people
 * is not a policy field.
 */
export function ScreenshotExclusionsCard() {
  const [people, setPeople] = useState<ApiEmployee[] | null>(null)
  const [saved, setSaved] = useState<string[] | null | undefined>(undefined)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [query, setQuery] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(() => {
    let live = true
    setError(null)
    Promise.all([readRoster(), getScreenshotExclusions()]).then(
      ([roster, ids]) => {
        if (!live) return
        setPeople(
          roster.employees
            .filter((e) => e.status !== "deactivated")
            .sort((a, b) => a.name.localeCompare(b.name)),
        )
        setSaved(ids)
        setPicked(new Set(ids ?? []))
      },
      (e: unknown) => {
        if (live) setError(e instanceof ApiError ? e.message : "Couldn't load the exclusions.")
      },
    )
    return () => {
      live = false
    }
  }, [])
  useEffect(() => load(), [load])

  const dirty = useMemo(() => {
    const before = new Set(saved ?? [])
    return before.size !== picked.size || [...picked].some((id) => !before.has(id))
  }, [saved, picked])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (people ?? []).filter((p) => !q || p.name.toLowerCase().includes(q))
  }, [people, query])

  async function save() {
    setSaving(true)
    try {
      const ids = await setScreenshotExclusions([...picked])
      setSaved(ids)
      setPicked(new Set(ids))
      toast.success("Screenshot exclusions saved")
    } catch (e) {
      if (e instanceof ApiError && e.code === "opt_outs_changed") {
        toast.error("Someone else changed this list. It has been reloaded, so make your change again.")
        load()
      } else {
        toast.error(e instanceof ApiError ? e.message : "Couldn't save the exclusions.")
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card id="screenshot-exclusions" className="scroll-mt-24 shadow-none">
      <CardHeader>
        <CardTitle>Excluded from screenshots</CardTitle>
        <CardDescription>
          Screenshots of the people you pick are never shown for review, sent for AI analysis or
          summarised. Their agent may still capture them; they age out under your retention setting.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {error ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={load}>
              Retry
            </Button>
          </div>
        ) : people === null || saved === undefined ? (
          <Loader label="Loading people…" />
        ) : saved === null ? (
          <p className="text-sm text-muted-foreground">
            Screenshot exclusions aren&apos;t available on this server yet.
          </p>
        ) : (
          <>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search people"
              aria-label="Search people to exclude from screenshots"
            />
            <ul className="max-h-72 divide-y overflow-y-auto rounded-md border">
              {shown.map((p) => {
                const id = `exclude-${p.user_id}`
                return (
                  <li key={p.user_id} className="flex items-center gap-3 px-3 py-2">
                    <Checkbox
                      id={id}
                      checked={picked.has(p.user_id)}
                      onCheckedChange={(on) =>
                        setPicked((prev) => {
                          const next = new Set(prev)
                          if (on) next.add(p.user_id)
                          else next.delete(p.user_id)
                          return next
                        })
                      }
                    />
                    <label htmlFor={id} className="flex-1 text-sm">
                      {p.name}
                      {p.title ? (
                        <span className="ml-2 text-xs text-muted-foreground">{p.title}</span>
                      ) : null}
                    </label>
                  </li>
                )
              })}
              {shown.length === 0 ? (
                <li className="px-3 py-4 text-center text-sm text-muted-foreground">
                  No one matches.
                </li>
              ) : null}
            </ul>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {picked.size === 0
                  ? "No one is excluded."
                  : `${picked.size} ${picked.size === 1 ? "person is" : "people are"} excluded.`}
              </p>
              <Button size="sm" onClick={() => void save()} disabled={!dirty || saving}>
                {saving ? "Saving…" : "Save exclusions"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
