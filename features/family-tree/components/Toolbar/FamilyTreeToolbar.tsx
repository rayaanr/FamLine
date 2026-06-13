'use client'

import { useReactFlow } from '@xyflow/react'
import { UserPlus, Maximize, FlaskConical, Trash2, Expand } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useFamilyStore } from '../../hooks/useFamilyStore'

interface FamilyTreeToolbarProps {
  onAddPerson: () => void
}

export function FamilyTreeToolbar({ onAddPerson }: FamilyTreeToolbarProps) {
  const { fitView } = useReactFlow()
  const personCount = useFamilyStore((s) => Object.keys(s.people).length)
  const collapsedCount = useFamilyStore((s) => s.collapsed.length)
  const loadMockData = useFamilyStore((s) => s.loadMockData)
  const clearTree = useFamilyStore((s) => s.clearTree)
  const expandAll = useFamilyStore((s) => s.expandAll)

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-background/90 p-2 shadow-sm backdrop-blur-sm">
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
        Load Demo
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

      <div className="h-5 w-px bg-border" />

      <Button
        size="icon-sm"
        variant="ghost"
        onClick={() => fitView({ duration: 300 })}
        title="Fit view"
      >
        <Maximize className="size-3.5" />
      </Button>

      {personCount > 0 && (
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {personCount} {personCount === 1 ? 'person' : 'people'}
        </span>
      )}
    </div>
  )
}
