"use client"

import { useEffect, useRef, useState } from "react"
import { ImagePlus, Upload, X, Clock } from "lucide-react"
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

interface PhotoEditorProps {
  open: boolean
  onClose: () => void
}

export function PhotoEditor({ open, onClose }: PhotoEditorProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  // Clean up preview URL on close
  useEffect(() => {
    if (!open) {
      setPreview(null)
      setFileName(null)
      setDragOver(false)
    }
  }, [open])

  function loadFile(file: File) {
    if (!file.type.startsWith("image/")) return
    setFileName(file.name)
    const url = URL.createObjectURL(file)
    setPreview(url)
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) loadFile(file)
    e.target.value = ""
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) loadFile(file)
  }

  function clearPreview() {
    setPreview(null)
    setFileName(null)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Upload profile photo</DialogTitle>
          <DialogDescription>
            Preview your selection below. Saving is not available yet — photo upload requires a backend connection (coming in a future phase).
          </DialogDescription>
        </DialogHeader>

        {/* Coming-soon notice */}
        <div className="flex items-start gap-2.5 rounded-md border border-border bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
          <Clock className="mt-0.5 size-3.5 shrink-0 text-warning" />
          <span>
            <strong className="font-medium text-foreground">Coming soon.</strong>{" "}
            You can preview a photo here, but it won&apos;t be saved until this feature launches.
          </span>
        </div>

        {preview ? (
          /* ── Preview state ── */
          <div className="space-y-3">
            <div className="relative mx-auto size-40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Preview"
                className="size-40 rounded-full object-cover ring-2 ring-border"
              />
              <button
                onClick={clearPreview}
                className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full bg-destructive text-white shadow"
                aria-label="Remove selected photo"
              >
                <X className="size-3.5" />
              </button>
            </div>
            {fileName && (
              <p className="text-center text-xs text-muted-foreground truncate px-4">
                {fileName}
              </p>
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
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            <span className={cn(
              "flex size-12 items-center justify-center rounded-full transition-colors",
              dragOver ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
            )}>
              <Upload className="size-5" />
            </span>
            <div className="space-y-1">
              <p className="text-sm font-medium">
                Click to upload or drag &amp; drop
              </p>
              <p className="text-xs text-muted-foreground">
                PNG, JPG, GIF up to 10 MB
              </p>
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
          <Button
            disabled
            className="gap-1.5 cursor-not-allowed opacity-50"
            title="Photo upload is not yet available"
          >
            <Upload className="size-3.5" />
            Save photo (coming soon)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
