'use client'

import { useReactFlow } from '@xyflow/react'
import { UserPlus, Users, GitMerge, Maximize } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useFamilyStore } from '../../hooks/useFamilyStore'

interface FamilyTreeToolbarProps {
  onAddPerson: () => void
  onAddCouple: () => void
  onAddParentChild: () => void
}

export function FamilyTreeToolbar({
  onAddPerson,
  onAddCouple,
  onAddParentChild,
}: FamilyTreeToolbarProps) {
  const { fitView } = useReactFlow()
  const personCount = useFamilyStore((s) => Object.keys(s.people).length)

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-background/90 p-2 shadow-sm backdrop-blur-sm">
      <Button size="sm" onClick={onAddPerson} className="gap-1.5">
        <UserPlus className="size-3.5" />
        Add Person
      </Button>

      <div className="h-5 w-px bg-border" />

      <Button size="sm" variant="outline" onClick={onAddCouple} className="gap-1.5">
        <Users className="size-3.5" />
        Couple
      </Button>

      <Button size="sm" variant="outline" onClick={onAddParentChild} className="gap-1.5">
        <GitMerge className="size-3.5" />
        Parent-Child
      </Button>

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
