'use client'

import { useState, useTransition } from 'react'
import {
  FileText,
  Download,
  Trash2,
  Loader2,
  FileUp,
  Plus,
  AlertCircleIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { useFileUpload } from '@/hooks/use-file-upload'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useMediaUpload } from '../../hooks/useMediaUpload'
import { getDownloadUrl, deleteMedia } from '../../server/media-actions'
import {
  DOC_TYPES,
  DOC_TYPE_LABELS,
  type DocType,
  type MediaAssetView,
} from '../../types'

const DOC_ACCEPT = 'image/*,application/pdf'
const MAX_DOC_MB = 25
const MAX_DOC_SIZE = MAX_DOC_MB * 1024 * 1024

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Popover-driven document upload: pick a type, then drop or browse a single
 * file. Replaces the old wall of one-dropzone-per-type so the Files tab stays
 * quiet until you choose to add something.
 */
function AddDocument({
  treeId,
  personId,
  onChanged,
}: {
  treeId: string
  personId: string
  onChanged: () => void
}) {
  const { upload, uploading } = useMediaUpload()
  const [open, setOpen] = useState(false)
  const [docType, setDocType] = useState<DocType>(DOC_TYPES[0])

  const [
    { isDragging, errors },
    {
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      openFileDialog,
      clearFiles,
      getInputProps,
    },
  ] = useFileUpload({
    accept: DOC_ACCEPT,
    maxSize: MAX_DOC_SIZE,
    onFilesAdded: async (added) => {
      const file = added[0]?.file
      if (!(file instanceof File)) return
      const ok = await upload(file, { treeId, kind: 'document', personId, docType })
      clearFiles()
      if (ok) {
        toast.success(`${DOC_TYPE_LABELS[docType]} added`)
        setOpen(false)
        onChanged()
      }
    },
  })

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button size="sm" variant="outline" className="w-full gap-1.5">
            <Plus className="size-3.5" />
            Add document
          </Button>
        }
      />
      <PopoverContent align="start" className="w-72">
        <div className="space-y-1">
          <p className="text-xs font-medium text-foreground">Type</p>
          <Select
            value={docType}
            onValueChange={(v) => setDocType(v as DocType)}
            itemToStringLabel={(v) => DOC_TYPE_LABELS[v as DocType] ?? String(v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOC_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {DOC_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div
          role="button"
          tabIndex={-1}
          onClick={openFileDialog}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          data-dragging={isDragging || undefined}
          className="relative flex min-h-24 flex-col items-center justify-center overflow-hidden rounded-lg border border-dashed border-input p-3 text-center transition-colors hover:bg-accent/50 data-[dragging=true]:bg-accent/50"
        >
          <input
            {...getInputProps()}
            aria-label={`Upload ${DOC_TYPE_LABELS[docType]}`}
            className="sr-only"
          />
          <FileUp className="mb-1 size-4 opacity-60" aria-hidden="true" />
          <p className="text-xs text-muted-foreground">
            Drop or click · Images or PDF · Max {MAX_DOC_MB}MB
          </p>
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/60">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        {errors.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-destructive" role="alert">
            <AlertCircleIcon className="size-3 shrink-0" />
            <span>{errors[0]}</span>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

export function MemberDocuments({
  treeId,
  personId,
  documents,
  canEdit,
  onChanged,
}: {
  treeId: string
  personId: string
  documents: MediaAssetView[]
  canEdit: boolean
  onChanged: () => void
}) {
  const [pending, startTransition] = useTransition()

  const download = (id: string) =>
    startTransition(async () => {
      const { url, error } = await getDownloadUrl(id)
      if (error || !url) {
        toast.error(error ?? 'Could not open document')
        return
      }
      window.open(url, '_blank', 'noopener')
    })

  const remove = (id: string) =>
    startTransition(async () => {
      const { error } = await deleteMedia(id)
      if (error) {
        toast.error(error)
        return
      }
      toast.success('Document removed')
      onChanged()
    })

  return (
    <div className="space-y-3">
      {documents.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-8 text-center text-muted-foreground">
          <FileText className="size-6" />
          <p className="text-sm">No documents yet.</p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center gap-2 rounded-lg border border-border p-2"
            >
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {DOC_TYPE_LABELS[doc.docType ?? 'other']}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {doc.fileName} · {formatSize(doc.size)}
                </p>
              </div>
              <Button
                size="icon-sm"
                variant="ghost"
                title="Download"
                disabled={pending}
                onClick={() => download(doc.id)}
              >
                <Download className="size-3.5" />
              </Button>
              {canEdit && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  title="Remove"
                  disabled={pending}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => remove(doc.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <AddDocument treeId={treeId} personId={personId} onChanged={onChanged} />
      )}
    </div>
  )
}
