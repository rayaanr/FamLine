'use client'

import { useEffect, useRef, useState } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Pencil, Plus, Heart, Baby, Crown } from 'lucide-react'
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
  const { person, onEdit, onAddSpouse, onAddChild, onAddParent } = data

  const [popoverOpen, setPopoverOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!popoverOpen) return
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setPopoverOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [popoverOpen])

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
      <div ref={containerRef} className="nodrag relative mt-2 flex gap-1">
        {/* Edit button */}
        <button
          onClick={() => onEdit(person.id)}
          className="flex h-6 w-6 items-center justify-center rounded-md border border-border bg-background/60 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Edit"
        >
          <Pencil className="size-3" />
        </button>

        {/* Add / + button */}
        <button
          onClick={() => setPopoverOpen((v) => !v)}
          className={cn(
            'flex h-6 flex-1 items-center justify-center gap-1 rounded-md border border-border bg-background/60 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
            popoverOpen && 'bg-muted text-foreground'
          )}
        >
          <Plus className="size-3" />
          Add
        </button>

        {/* Popover */}
        {popoverOpen && (
          <div className="nopan absolute bottom-full left-0 z-[1000] mb-1.5 w-44 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg">
            <button
              onClick={() => { onAddSpouse(person.id); setPopoverOpen(false) }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Heart className="size-3.5 shrink-0 text-pink-400" />
              Add Partner
            </button>
            <button
              onClick={() => { onAddChild(person.id); setPopoverOpen(false) }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Baby className="size-3.5 shrink-0 text-blue-400" />
              Add Child
            </button>
            <button
              onClick={() => { onAddParent(person.id); setPopoverOpen(false) }}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Crown className="size-3.5 shrink-0 text-amber-400" />
              Add Parent
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
