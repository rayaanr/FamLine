'use client'

import { useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import Link from 'next/link'
import { UserPlus, Maximize, FlaskConical, Trash2, Expand, ArrowLeft, HelpCircle, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useFamilyStore, useActiveTree } from '../../hooks/useFamilyStore'
import { useTreeAccess } from '../../hooks/useTreeAccess'
import { isPlaceholderPerson } from '../../utils/person'
import { MembersDialog } from '../dialogs/MembersDialog'

interface FamilyTreeToolbarProps {
  onAddPerson: () => void
  canEdit: boolean
}

export function FamilyTreeToolbar({ onAddPerson, canEdit }: FamilyTreeToolbarProps) {
  const { fitView } = useReactFlow()
  const { canManage } = useTreeAccess()
  const tree = useActiveTree()
  const [membersOpen, setMembersOpen] = useState(false)
  const personCount = Object.keys(tree.people).length
  const collapsedCount = tree.collapsed.length
  const placeholders = Object.values(tree.people).filter(isPlaceholderPerson)

  const focusPlaceholders = () =>
    fitView({
      nodes: placeholders.map((p) => ({ id: `person-${p.id}` })),
      duration: 400,
      padding: 0.3,
    })
  const loadMockData = useFamilyStore((s) => s.loadMockData)
  const clearTree = useFamilyStore((s) => s.clearTree)
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

          <div className="h-5 w-px bg-border" />

          <Button
            size="sm"
            variant="outline"
            onClick={() => { loadMockData(); setTimeout(() => fitView({ duration: 400 }), 50) }}
            className="gap-1.5"
            title="Load demo family"
          >
            <FlaskConical className="size-3.5" />
          </Button>

          {personCount > 0 && (
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={clearTree}
              title="Clear tree"
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}

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
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {personCount} {personCount === 1 ? 'person' : 'people'}
        </span>
      )}

      {canManage && (
        <>
          <div className="h-5 w-px bg-border" />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setMembersOpen(true)}
            className="gap-1.5 text-muted-foreground"
            title="Manage who can access this tree"
          >
            <Users className="size-3.5" />
            Members
          </Button>
        </>
      )}
    </div>

    {canManage && (
      <MembersDialog
        treeId={tree.id}
        open={membersOpen}
        onClose={() => setMembersOpen(false)}
      />
    )}
    </>
  )
}
