'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { requestUpload, confirmUpload } from '../server/media-actions'
import type { DocType, MediaKind } from '../types'

interface UploadArgs {
  treeId: string
  kind: MediaKind
  personId?: string
  docType?: DocType
}

/**
 * Direct-to-R2 upload: ask the server for a presigned PUT URL, send the file
 * straight to the bucket, then confirm so the asset is recorded. Returns true
 * on success. Surfaces failures as toasts.
 */
export function useMediaUpload() {
  const [uploading, setUploading] = useState(false)

  const upload = useCallback(
    async (file: File, args: UploadArgs): Promise<boolean> => {
      setUploading(true)
      const spec = {
        treeId: args.treeId,
        kind: args.kind,
        personId: args.personId,
        docType: args.docType,
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        size: file.size,
      }
      try {
        const { ticket, error } = await requestUpload(spec)
        if (error || !ticket) {
          toast.error(error ?? 'Upload failed')
          return false
        }

        const put = await fetch(ticket.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': spec.contentType },
          body: file,
        })
        if (!put.ok) {
          toast.error('Upload to storage failed')
          return false
        }

        const { error: confirmError } = await confirmUpload({
          ...spec,
          assetId: ticket.assetId,
        })
        if (confirmError) {
          toast.error(confirmError)
          return false
        }
        return true
      } catch {
        toast.error('Upload failed')
        return false
      } finally {
        setUploading(false)
      }
    },
    [],
  )

  return { upload, uploading }
}
