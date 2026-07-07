"use client"

import { useEffect, useRef, useState } from "react"
import { ImagePlus, Upload, X } from "lucide-react"
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

interface PhotoEditorProps {
  open: boolean
  onClose: () => void
  /**
   * When provided, the chosen image is applied immediately (as a data URL) —
   * used by the employee's editable profile. Without it the dialog is a
   * backend-pending stub.
   */
  onApply?: (dataUrl: string) => void
}

export function PhotoEditor({ open, onClose, onApply }: PhotoEditorProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  // Clean up preview URL on close
  useEffect(() => {
    if (!open) {
      setPreview(null)
      setFile(null)
      setFileName(null)
      setDragOver(false)
    }
  }, [open])

  function loadFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file.")
      return
    }
    if (!isWithinSize(file, 10 * MB)) {
      toast.error("Image must be 10 MB or smaller.")
      return
    }
    setFile(file)
    setFileName(file.name)
    const url = URL.createObjectURL(file)
    setPreview(url)
  }

  function apply() {
    if (!file) return
    if (!onApply) {
      toast.info("Photo upload will be available once the backend is connected.")
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      onApply(reader.result as string)
      toast.success("Profile photo updated")
      onClose()
    }
    reader.readAsDataURL(file)
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
            {onApply
              ? "Choose an image to use as your profile photo."
              : "Photo upload will be saved to AWS S3 once the backend is connected."}
          </DialogDescription>
        </DialogHeader>

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
          <Button disabled={!preview} className="gap-1.5" onClick={apply}>
            <Upload className="size-3.5" />
            {onApply ? "Save photo" : "Upload photo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
