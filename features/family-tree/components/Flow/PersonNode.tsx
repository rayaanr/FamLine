'use client'

import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Edit, UserPlus, GitMerge } from 'lucide-react'
import { cn } from '@/lib/utils'
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
  const { person, onEdit, onAddSpouse, onAddChild } = data

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
      {/* Top handle — receives parent edges */}
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="!bg-slate-400 !w-2.5 !h-2.5 !border-background !border-2"
      />

      {/* Left handle — spouse connection */}
      <Handle
        type="target"
        position={Position.Left}
        id="spouse-left"
        className="!bg-slate-400 !w-2.5 !h-2.5 !border-background !border-2"
      />

      {/* Right handle — spouse connection */}
      <Handle
        type="source"
        position={Position.Right}
        id="spouse-right"
        className="!bg-slate-400 !w-2.5 !h-2.5 !border-background !border-2"
      />

      {/* Bottom handle — sends to couple nodes */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="!bg-slate-400 !w-2.5 !h-2.5 !border-background !border-2"
      />

      {/* Content */}
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

      {/* Action buttons */}
      <div className="nodrag mt-2 flex gap-1">
        <button
          onClick={() => onEdit(person.id)}
          className="flex h-6 flex-1 items-center justify-center gap-1 rounded-md border border-border bg-background/60 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Edit person"
        >
          <Edit className="size-3" />
          Edit
        </button>
        <button
          onClick={() => onAddSpouse(person.id)}
          className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-background/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Add spouse / partner"
        >
          <UserPlus className="size-3" />
        </button>
        <button
          onClick={() => onAddChild(person.id)}
          className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-background/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Add child"
        >
          <GitMerge className="size-3" />
        </button>
      </div>
    </div>
  )
}
