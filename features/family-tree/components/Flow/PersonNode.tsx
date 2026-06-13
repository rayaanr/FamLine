'use client'

import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Pencil, Plus, Heart, Baby, Crown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { PersonFlowNode } from '../../utils/layout'

const genderStyles: Record<string, string> = {
  male: 'bg-blue-50 border-blue-300 dark:bg-blue-950 dark:border-blue-700',
  female: 'bg-pink-50 border-pink-300 dark:bg-pink-950 dark:border-pink-700',
  other: 'bg-purple-50 border-purple-300 dark:bg-purple-950 dark:border-purple-700',
  unknown: 'bg-muted border-border',
}

const genderDot: Record<string, string> = {
  male: 'bg-blue-400',
  female: 'bg-pink-400',
  other: 'bg-purple-400',
  unknown: 'bg-muted-foreground',
}

export function PersonNode({ data }: NodeProps<PersonFlowNode>) {
  const { person, onEdit, onAddSpouse, onAddChild, onAddParent } = data

  const birthYear = person.birthDate ? person.birthDate.slice(0, 4) : null
  const deathYear = person.deathDate ? person.deathDate.slice(0, 4) : null
  const dateStr = birthYear
    ? deathYear
      ? `${birthYear} – ${deathYear}`
      : `b. ${birthYear}`
    : null

  return (
    <div
      className={cn(
        'relative w-[200px] rounded-xl border-2 bg-card px-3 py-2 shadow-sm transition-shadow hover:shadow-md',
        genderStyles[person.gender],
        person.isDeceased && 'opacity-60'
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="!bg-slate-400 !w-2.5 !h-2.5 !border-background !border-2"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="spouse-left"
        className="!bg-slate-400 !w-2.5 !h-2.5 !border-background !border-2"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="spouse-right"
        className="!bg-slate-400 !w-2.5 !h-2.5 !border-background !border-2"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="!bg-slate-400 !w-2.5 !h-2.5 !border-background !border-2"
      />

      {/* Person info */}
      <div className="flex items-start gap-2">
        <div className={cn('mt-1 size-2.5 shrink-0 rounded-full', genderDot[person.gender])} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight text-foreground">
            {person.firstName} {person.lastName}
          </p>
          {dateStr && (
            <p className="mt-0.5 text-xs text-muted-foreground">{dateStr}</p>
          )}
          {person.isDeceased && !deathYear && (
            <p className="mt-0.5 text-xs text-muted-foreground">†</p>
          )}
        </div>
      </div>

      {/* Action row */}
      <div className="nodrag nopan mt-2 flex gap-1">
        <button
          onClick={() => onEdit(person.id)}
          className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-background/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Edit"
        >
          <Pencil className="size-3" />
        </button>

        <Popover>
          <PopoverTrigger className="flex h-6 flex-1 items-center justify-center gap-1 rounded-md border border-border bg-background/60 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <Plus className="size-3" />
            Add
          </PopoverTrigger>
          <PopoverContent className="nodrag nopan w-44 p-1" side="top" align="start">
            <button
              onClick={() => onAddSpouse(person.id)}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Heart className="size-3.5 shrink-0 text-pink-400" />
              Add Partner
            </button>
            <button
              onClick={() => onAddChild(person.id)}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Baby className="size-3.5 shrink-0 text-blue-400" />
              Add Child
            </button>
            <button
              onClick={() => onAddParent(person.id)}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Crown className="size-3.5 shrink-0 text-amber-400" />
              Add Parent
            </button>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
