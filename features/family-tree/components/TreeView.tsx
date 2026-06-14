'use client'

import { useEffect } from 'react'
import { useFamilyStore } from '../hooks/useFamilyStore'
import { TreeAccessProvider } from '../hooks/useTreeAccess'
import { FamilyTreeCanvas } from './Flow/FamilyTreeCanvas'
import type { NamedFamilyTree } from '../types'
import type { TreeRole } from '@/lib/permissions'

function Spinner() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
    </div>
  )
}

/**
 * Hydrates the DB-backed tree (provided by the server page, which has already
 * gated access) into the store and renders the canvas. The role drives which
 * editing controls are shown.
 */
export function TreeView({
  tree,
  role,
}: {
  tree: NamedFamilyTree
  role: TreeRole
}) {
  const loadTree = useFamilyStore((s) => s.loadTree)
  const isActive = useFamilyStore((s) => s.activeTreeId === tree.id)

  useEffect(() => {
    loadTree(tree)
  }, [tree, loadTree])

  if (!isActive) return <Spinner />

  return (
    <TreeAccessProvider role={role}>
      <FamilyTreeCanvas />
    </TreeAccessProvider>
  )
}
