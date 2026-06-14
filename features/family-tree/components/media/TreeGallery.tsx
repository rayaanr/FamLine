"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { ImagePlus, Trash2, Loader2, Images } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useMediaUpload } from "../../hooks/useMediaUpload";
import { listGallery, deleteMedia } from "../../server/media-actions";
import type { MediaAssetView } from "../../types";

export function TreeGallery({
  open,
  onClose,
  treeId,
  canEdit,
}: {
  open: boolean;
  onClose: () => void;
  treeId: string;
  canEdit: boolean;
}) {
  // `null` = not loaded yet (drives the spinner) - avoids a synchronous
  // setState in the open effect.
  const [items, setItems] = useState<MediaAssetView[] | null>(null);
  const { upload, uploading } = useMediaUpload();
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const refresh = useCallback(() => {
    listGallery(treeId)
      .then(setItems)
      .catch(() => {});
  }, [treeId]);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const loading = items === null;

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    let added = 0;
    for (const file of files) {
      const ok = await upload(file, { treeId, kind: "gallery" });
      if (ok) added++;
    }
    if (added > 0) {
      toast.success(added === 1 ? "Photo added" : `${added} photos added`);
      refresh();
    }
  };

  const remove = (id: string) =>
    startTransition(async () => {
      const { error } = await deleteMedia(id);
      if (error) {
        toast.error(error);
        return;
      }
      setItems((prev) => prev?.filter((i) => i.id !== id) ?? prev);
    });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Family gallery</DialogTitle>
          <DialogDescription>
            Shared photos for this family tree.
          </DialogDescription>
        </DialogHeader>

        {canEdit && (
          <div>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={onPick}
            />
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={uploading}
              onClick={() => fileInput.current?.click()}
            >
              {uploading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <ImagePlus className="size-3.5" />
              )}
              Add photos
            </Button>
          </div>
        )}

        <div className="max-h-[60vh] overflow-y-auto">
          {loading || !items ? (
            <div className="flex justify-center py-10">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
              <Images className="size-8" />
              <p className="text-sm">No photos yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
                >
                  <a href={item.url} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.url}
                      alt={item.fileName}
                      className="size-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                  </a>
                  {canEdit && (
                    <button
                      onClick={() => remove(item.id)}
                      disabled={pending}
                      title="Delete photo"
                      className="absolute right-1 top-1 flex size-7 items-center justify-center rounded-md bg-background/80 text-destructive opacity-0 shadow-sm backdrop-blur-sm transition-opacity hover:bg-background group-hover:opacity-100"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
