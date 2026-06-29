"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Upload, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth.store";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PhotoEditorProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Square cover-crop the chosen image to a 256px JPEG data URL. Keeping it small
 * means the avatar persists in the auth store (localStorage) without blowing the
 * quota — the frontend-only stand-in for an upload endpoint.
 */
async function fileToAvatarDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function PhotoEditor({ open, onClose }: PhotoEditorProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const updateAvatar = useAuthStore((s) => s.updateAvatar);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setPreview(null);
      setFileName(null);
      setDragOver(false);
      setBusy(false);
    }
  }, [open]);

  async function loadFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    setBusy(true);
    setFileName(file.name);
    try {
      setPreview(await fileToAvatarDataUrl(file));
    } catch {
      toast.error("Couldn't read that image");
      setPreview(null);
      setFileName(null);
    } finally {
      setBusy(false);
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) loadFile(file);
  }

  function clearPreview() {
    setPreview(null);
    setFileName(null);
  }

  function save() {
    if (!preview) return;
    try {
      updateAvatar(preview);
      toast.success("Profile photo updated");
      onClose();
    } catch {
      toast.error("That image is too large to save — try a smaller one");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Profile photo</DialogTitle>
          <DialogDescription>
            Upload a photo — it&apos;s cropped to a square and saved to your
            profile on this device.
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
            <button
              onClick={() => fileRef.current?.click()}
              className="mx-auto flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              <ImagePlus className="size-3.5" />
              {fileName ? `Replace ${fileName}` : "Choose a different photo"}
            </button>
          </div>
        ) : (
          /* ── Drop-zone state ── */
          <button
            className={cn(
              "flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors",
              dragOver
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50 hover:bg-muted/40",
            )}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            <Upload
              className={cn(
                "size-5 transition-colors",
                dragOver ? "text-primary" : "text-muted-foreground",
              )}
            />
            <div className="space-y-0.5">
              <p className="text-sm font-medium">
                Click to upload or drag &amp; drop
              </p>
              <p className="text-xs text-muted-foreground">
                PNG, JPG, GIF · max 10 MB
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
          <Button onClick={save} disabled={!preview || busy}>
            {busy ? "Processing…" : "Save photo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
