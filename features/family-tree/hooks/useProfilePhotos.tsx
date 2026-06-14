'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import { listProfilePhotos } from '../server/media-actions'

interface ProfilePhotosValue {
  /** personId → short-lived presigned profile-photo URL. */
  photos: Record<string, string>
  /** Re-fetch the map (call after a photo changes). */
  refresh: () => void
}

const ProfilePhotosContext = createContext<ProfilePhotosValue>({
  photos: {},
  refresh: () => {},
})

/**
 * Loads every member's profile-photo URL for a tree in a single request and
 * shares it with the canvas nodes, so each node doesn't fetch on its own.
 */
export function ProfilePhotosProvider({
  treeId,
  children,
}: {
  treeId: string
  children: React.ReactNode
}) {
  const [photos, setPhotos] = useState<Record<string, string>>({})

  const refresh = useCallback(() => {
    listProfilePhotos(treeId)
      .then(setPhotos)
      .catch(() => {})
  }, [treeId])

  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <ProfilePhotosContext.Provider value={{ photos, refresh }}>
      {children}
    </ProfilePhotosContext.Provider>
  )
}

export const useProfilePhotos = () => useContext(ProfilePhotosContext)
