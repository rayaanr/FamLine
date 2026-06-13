'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useFamilyStore } from '../hooks/useFamilyStore'
import { useHydration } from '../hooks/useHydration'
import { FamilyTreeCanvas } from './Flow/FamilyTreeCanvas'

function Spinner() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
    </div>
  )
}

/**
 * Renders the canvas for a specific tree. The URL is the source of truth:
 * we sync the store's active tree to the route param, and bounce to the
 * gallery if the id doesn't exist (e.g. a deleted or stale bookmark).
 */
export function TreeView({ treeId }: { treeId: string }) {
  const hydrated = useHydration()
  const router = useRouter()
  const exists = useFamilyStore((s) => !!s.trees[treeId])
  const isActive = useFamilyStore((s) => s.activeTreeId === treeId)
  const setActiveTree = useFamilyStore((s) => s.setActiveTree)

  useEffect(() => {
    if (!hydrated) return
    if (!exists) {
      router.replace('/tree')
      return
    }
    if (!isActive) setActiveTree(treeId)
  }, [hydrated, exists, isActive, treeId, setActiveTree, router])

  // Wait until the store's active tree matches the URL so the canvas never
  // flashes the previously-active tree.
  if (!hydrated || !exists || !isActive) return <Spinner />

  return <FamilyTreeCanvas />
}
