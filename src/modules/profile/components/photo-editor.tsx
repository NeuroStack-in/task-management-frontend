"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ImagePlus, Trash2, Upload, ZoomIn, ZoomOut } from "lucide-react"
import { toast } from "sonner"
import { isWithinSize, MB } from "@/lib/validation"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Edge of the square crop viewport, in CSS pixels. */
const VIEWPORT = 256
/** Edge of the exported square image. Avatars render at 96px at most; 512 covers retina and zoom. */
const OUTPUT = 512
const MIN_ZOOM = 1
const MAX_ZOOM = 4

interface PhotoEditorProps {
  open: boolean
  onClose: () => void
  /**
   * Called with the **cropped** square image when the user confirms. The parent owns the real
   * upload flow (WebP encode → presigned S3 PUT → profile PATCH) and its progress/error toasts.
   */
  onApply: (file: File) => void
  /**
   * Called when the user removes their existing photo. Omitted ⇒ no remove control is offered,
   * which is the correct state when there is nothing to remove.
   */
  onRemove?: () => void
  /** Whether a photo currently exists — drives the remove control and the copy. */
  hasPhoto?: boolean
}

/**
 * Pick → **crop** → confirm.
 *
 * The crop step exists because avatars render in a circle everywhere in the product, and a
 * straight upload let the browser decide what a non-square photo becomes: `object-cover` centre-
 * crops it, so a portrait taken in landscape lost whoever was standing to one side. Choosing the
 * square yourself is the difference between a usable avatar and a picture of someone's shoulder.
 *
 * Deliberately dependency-free — pan/zoom over a `<canvas>` export, no crop library. The geometry
 * is small enough to own (see `draw`), and this is the only crop surface in the product, so a
 * dependency would carry its own API, bundle weight and upgrade cost for one dialog.
 */
export function PhotoEditor({ open, onClose, onApply, onRemove, hasPhoto }: PhotoEditorProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [src, setSrc] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [busy, setBusy] = useState(false)

  // Crop state. `offset` is the image's top-left corner relative to the viewport's, in CSS px.
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [baseScale, setBaseScale] = useState(1)
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  const reset = useCallback(() => {
    setSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    imgRef.current = null
    setFileName(null)
    setDragOver(false)
    setBusy(false)
    setZoom(1)
    setOffset({ x: 0, y: 0 })
    setBaseScale(1)
  }, [])

  useEffect(() => {
    if (!open) reset()
  }, [open, reset])

  // Revoke the object URL on unmount too — closing is not the only way this component goes away.
  useEffect(() => () => reset(), [reset])

  /** Keep the image covering the viewport: the top-left may never move inside the square. */
  const clamp = useCallback(
    (x: number, y: number, scale: number) => {
      const img = imgRef.current
      if (!img) return { x, y }
      const w = img.naturalWidth * scale
      const h = img.naturalHeight * scale
      return {
        x: Math.min(0, Math.max(VIEWPORT - w, x)),
        y: Math.min(0, Math.max(VIEWPORT - h, y)),
      }
    },
    [],
  )

  function loadFile(f: File) {
    if (!f.type.startsWith("image/")) {
      toast.error("Choose an image file.")
      return
    }
    if (!isWithinSize(f, 10 * MB)) {
      toast.error("Image must be 10 MB or smaller.")
      return
    }
    const url = URL.createObjectURL(f)
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      // "Cover" the square: the SHORTER edge fills it, so there is never a blank corner to crop into.
      const base = VIEWPORT / Math.min(img.naturalWidth, img.naturalHeight)
      setBaseScale(base)
      setZoom(1)
      // Centre it — the middle of a photo is the right first guess, and the user adjusts from there.
      setOffset({
        x: (VIEWPORT - img.naturalWidth * base) / 2,
        y: (VIEWPORT - img.naturalHeight * base) / 2,
      })
      setSrc(url)
      setFileName(f.name)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      toast.error("That image couldn't be read. Try a different file.")
    }
    img.src = url
  }

  function onZoom(next: number) {
    const img = imgRef.current
    if (!img) return
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next))
    // Zoom about the viewport's centre, so the face you framed stays framed instead of drifting
    // toward a corner as the image grows.
    const oldScale = baseScale * zoom
    const newScale = baseScale * z
    const cx = VIEWPORT / 2 - offset.x
    const cy = VIEWPORT / 2 - offset.y
    const ratio = newScale / oldScale
    setZoom(z)
    setOffset(clamp(VIEWPORT / 2 - cx * ratio, VIEWPORT / 2 - cy * ratio, newScale))
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!src) return
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y }
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current
    if (!d) return
    setOffset(clamp(d.ox + (e.clientX - d.x), d.oy + (e.clientY - d.y), baseScale * zoom))
  }
  function onPointerUp() {
    drag.current = null
  }

  /** Render the visible square to a canvas and hand the parent a real File. */
  async function apply() {
    const img = imgRef.current
    if (!img || busy) return
    setBusy(true)
    try {
      const scale = baseScale * zoom
      const canvas = document.createElement("canvas")
      canvas.width = OUTPUT
      canvas.height = OUTPUT
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("no 2d context")
      ctx.imageSmoothingQuality = "high"
      // The source rectangle is the viewport, mapped back into the image's own pixel space.
      ctx.drawImage(
        img,
        -offset.x / scale,
        -offset.y / scale,
        VIEWPORT / scale,
        VIEWPORT / scale,
        0,
        0,
        OUTPUT,
        OUTPUT,
      )
      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob(res, "image/webp", 0.9),
      )
      if (!blob) throw new Error("encode failed")
      onApply(new File([blob], "avatar.webp", { type: "image/webp" }))
      onClose()
    } catch {
      toast.error("Couldn't process that image. Try a different one.")
      setBusy(false)
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) loadFile(f)
    e.target.value = ""
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f) loadFile(f)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{src ? "Position your photo" : "Upload profile photo"}</DialogTitle>
          <DialogDescription>
            {src
              ? "Drag to reposition and zoom to fit. The circle is what everyone will see."
              : "Choose an image to use as your profile photo."}
          </DialogDescription>
        </DialogHeader>

        {src ? (
          /* ── Crop state ── */
          <div className="space-y-3">
            <div
              className="relative mx-auto cursor-grab touch-none overflow-hidden rounded-full bg-muted ring-2 ring-border active:cursor-grabbing"
              style={{ width: VIEWPORT, height: VIEWPORT }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              role="application"
              aria-label="Drag to reposition your photo"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                draggable={false}
                className="pointer-events-none absolute left-0 top-0 max-w-none select-none"
                style={{
                  width: (imgRef.current?.naturalWidth ?? 0) * baseScale * zoom,
                  height: (imgRef.current?.naturalHeight ?? 0) * baseScale * zoom,
                  transform: `translate(${offset.x}px, ${offset.y}px)`,
                }}
              />
            </div>

            <div className="flex items-center gap-3 px-2">
              <ZoomOut className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <input
                type="range"
                min={MIN_ZOOM}
                max={MAX_ZOOM}
                step={0.01}
                value={zoom}
                onChange={(e) => onZoom(Number(e.target.value))}
                className="accent-primary h-1 w-full cursor-pointer"
                aria-label="Zoom"
              />
              <ZoomIn className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </div>

            {fileName && (
              <p className="truncate px-4 text-center text-xs text-muted-foreground">{fileName}</p>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              className="mx-auto flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              <ImagePlus className="size-3.5" />
              Choose a different photo
            </button>
          </div>
        ) : (
          /* ── Drop-zone state ── */
          <button
            className={cn(
              "flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors",
              dragOver
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-muted/40",
            )}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            <span
              className={cn(
                "flex size-12 items-center justify-center rounded-full transition-colors",
                dragOver ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
              )}
            >
              <Upload className="size-5" />
            </span>
            <div className="space-y-1">
              <p className="text-sm font-medium">Click to upload or drag &amp; drop</p>
              <p className="text-xs text-muted-foreground">PNG, JPG, GIF up to 10 MB</p>
            </div>
          </button>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={onInputChange}
        />

        <DialogFooter showCloseButton>
          {/* Removing is offered only when a photo exists AND none is staged — mid-crop, "remove"
              would ambiguously mean the old one or the new one. */}
          {hasPhoto && !src && onRemove && (
            <Button
              variant="ghost"
              className="mr-auto gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                onRemove()
                onClose()
              }}
            >
              <Trash2 className="size-3.5" />
              Remove photo
            </Button>
          )}
          <Button disabled={!src || busy} className="gap-1.5" onClick={apply}>
            <Upload className="size-3.5" />
            {busy ? "Processing…" : "Save photo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
