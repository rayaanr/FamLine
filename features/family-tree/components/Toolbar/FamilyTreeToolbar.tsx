'use client'

import { useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import Link from 'next/link'
import { UserPlus, Maximize, Expand, ArrowLeft, HelpCircle, Settings, Users, Images } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useFamilyStore, useActiveTree } from '../../hooks/useFamilyStore'
import { isPlaceholderPerson } from '../../utils/person'
import { TreeSettingsDialog } from '../TreeSettingsDialog'
import { TreeGallery } from '../media/TreeGallery'

interface FamilyTreeToolbarProps {
  onAddPerson: () => void
  canEdit: boolean
}

export function FamilyTreeToolbar({ onAddPerson, canEdit }: FamilyTreeToolbarProps) {
  const { fitView } = useReactFlow()
  const tree = useActiveTree()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const personCount = Object.keys(tree.people).length
  const collapsedCount = tree.collapsed.length
  const placeholders = Object.values(tree.people).filter(isPlaceholderPerson)

  const focusPlaceholders = () =>
    fitView({
      nodes: placeholders.map((p) => ({ id: `person-${p.id}` })),
      duration: 400,
      padding: 0.3,
    })
  const expandAll = useFamilyStore((s) => s.expandAll)

  return (
    <>
    <div className="flex items-center gap-2 rounded-xl border border-border bg-background/90 p-2 shadow-sm backdrop-blur-sm">
      <Button
        variant="ghost"
        size="sm"
        nativeButton={false}
        className="gap-1.5 text-muted-foreground"
        title="Back to all trees"
        render={<Link href="/tree" />}
      >
        <ArrowLeft className="size-3.5" />
        All trees
      </Button>

      {canEdit && (
        <>
          <div className="h-5 w-px bg-border" />

          <Button size="sm" onClick={onAddPerson} className="gap-1.5">
            <UserPlus className="size-3.5" />
            Add Person
          </Button>

          {collapsedCount > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={expandAll}
              title="Expand all collapsed branches"
              className="gap-1.5 text-muted-foreground"
            >
              <Expand className="size-3.5" />
              Expand all
            </Button>
          )}
        </>
      )}

      <div className="h-5 w-px bg-border" />

      <Button
        size="icon-sm"
        variant="ghost"
        onClick={() => fitView({ duration: 300 })}
        title="Fit view"
      >
        <Maximize className="size-3.5" />
      </Button>

      {placeholders.length > 0 && (
        <Button
          size="sm"
          variant="ghost"
          onClick={focusPlaceholders}
          title="Zoom to people who still need details"
          className="gap-1.5 text-amber-600 hover:text-amber-700 dark:text-amber-500"
        >
          <HelpCircle className="size-3.5" />
          {placeholders.length} need{placeholders.length === 1 ? 's' : ''} details
        </Button>
      )}

      {personCount > 0 && (
        <Badge
          variant="secondary"
          className="gap-1"
          title={`${personCount} ${personCount === 1 ? 'person' : 'people'}`}
        >
          <Users className="size-3.5" />
          {personCount}
        </Badge>
      )}

      <div className="h-5 w-px bg-border" />

      <Button
        size="icon-sm"
        variant="ghost"
        onClick={() => setGalleryOpen(true)}
        title="Family gallery"
        className="text-muted-foreground"
      >
        <Images className="size-3.5" />
      </Button>

      <Button
        size="icon-sm"
        variant="ghost"
        onClick={() => setSettingsOpen(true)}
        title="Tree settings"
        className="text-muted-foreground"
      >
        <Settings className="size-3.5" />
      </Button>
    </div>

    <TreeGallery
      open={galleryOpen}
      onClose={() => setGalleryOpen(false)}
      treeId={tree.id}
      canEdit={canEdit}
    />
    <TreeSettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  )
}
