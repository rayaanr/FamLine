'use client'

import { useEffect, useTransition } from 'react'
import { Camera, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useFileUpload } from '@/hooks/use-file-upload'
import { useMediaUpload } from '../../hooks/useMediaUpload'
import { deleteMedia } from '../../server/media-actions'
import type { MediaAssetView } from '../../types'

const MAX_MB = 5
const MAX_SIZE = MAX_MB * 1024 * 1024

/**
 * The member's avatar, doubling as the profile-photo control. Viewers just see
 * the photo (or initials); editors get a hover camera overlay to replace it and
 * a remove button when a photo exists. Replaces the old standalone dropzone so
 * the detail sheet reads as a profile, not a form.
 */
export function MemberProfilePhoto({
  treeId,
  personId,
  profile,
  canEdit,
  name,
  fallback,
  className,
  onChanged,
}: {
  treeId: string
  personId: string
  profile: MediaAssetView | null
  canEdit: boolean
  name: string
  fallback: React.ReactNode
  className?: string
  onChanged: () => void
}) {
  const { upload, uploading } = useMediaUpload()
  const [pending, startTransition] = useTransition()

  const [
    { files, errors },
    { handleDragEnter, handleDragLeave, handleDragOver, handleDrop, openFileDialog, clearFiles, getInputProps },
  ] = useFileUpload({
    accept: 'image/*',
    maxSize: MAX_SIZE,
    onFilesAdded: async (added) => {
      const file = added[0]?.file
      if (!(file instanceof File)) return
      const ok = await upload(file, { treeId, kind: 'profile', personId })
      clearFiles()
      if (ok) {
        toast.success('Photo updated')
        onChanged()
      }
    },
  })

  useEffect(() => {
    if (errors.length > 0) toast.error(errors[0])
  }, [errors])

  const localPreview = files[0]?.preview
  const previewUrl = localPreview ?? profile?.url ?? null
  const busy = uploading || pending

  const remove = () => {
    if (!profile) return
    const id = profile.id
    startTransition(async () => {
      const { error } = await deleteMedia(id)
      if (error) {
        toast.error(error)
        return
      }
      toast.success('Photo removed')
      onChanged()
    })
  }

  const avatar = (
    <Avatar size="lg" className={cn('shrink-0', className)}>
      {previewUrl && <AvatarImage src={previewUrl} alt={name} />}
      <AvatarFallback className={cn('font-semibold', className)}>{fallback}</AvatarFallback>
    </Avatar>
  )

  if (!canEdit) return avatar

  return (
    <div className="group/photo relative shrink-0">
      <input {...getInputProps()} aria-label="Upload profile photo" className="sr-only" />
      <button
        type="button"
        onClick={openFileDialog}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        aria-label={profile ? 'Change profile photo' : 'Add profile photo'}
        className="relative block rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {avatar}
        <span
          aria-hidden
          className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover/photo:opacity-100"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
        </span>
      </button>
      {profile && !busy && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            if (localPreview) clearFiles()
            else remove()
          }}
          aria-label="Remove photo"
          className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-foreground text-background opacity-0 shadow-sm outline-none transition-opacity hover:bg-foreground/80 group-hover/photo:opacity-100 focus-visible:opacity-100"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  )
}
