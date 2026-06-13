'use client'

import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CoupleFlowNode } from '../../utils/layout'

const statusColors: Record<string, string> = {
  married: 'bg-green-400',
  divorced: 'bg-red-400',
  separated: 'bg-amber-400',
  partnered: 'bg-blue-400',
}

const statusLabels: Record<string, string> = {
  married: '♥',
  divorced: '✕',
  separated: '~',
  partnered: '♡',
}

export function CoupleNode({ data }: NodeProps<CoupleFlowNode>) {
  const { couple, onEdit, isCollapsed, hiddenCount, hasChildren, onToggleCollapse } = data

  return (
    <div
      className={cn(
        'nodrag relative flex size-10 cursor-pointer items-center justify-center rounded-full border-2 bg-background shadow-sm transition-shadow hover:shadow-md',
        isCollapsed ? 'border-primary' : 'border-border'
      )}
      onClick={() => onEdit(couple.id)}
      title={`${couple.status} — click to edit`}
    >
      {/* Left handle — receives partner1 or partner2 */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="bg-slate-400! size-2! border-background! border!"
      />

      {/* Right handle — receives partner1 or partner2 */}
      <Handle
        type="target"
        position={Position.Right}
        id="right"
        className="bg-slate-400! size-2! border-background! border!"
      />

      {/* Bottom handle — children go down from here */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="bg-slate-400! size-2! border-background! border!"
      />

      <div className={cn('size-3 rounded-full', statusColors[couple.status])}>
        <span className="sr-only">{statusLabels[couple.status]}</span>
      </div>

      {/* Collapse / expand this couple's descendants */}
      {hasChildren && (
        <button
          className={cn(
            'nodrag nopan absolute -bottom-7 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none shadow-sm transition-colors',
            isCollapsed
              ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/20'
              : 'border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground'
          )}
          onClick={(e) => {
            e.stopPropagation()
            onToggleCollapse(`couple-${couple.id}`)
          }}
          title={isCollapsed ? `Show ${hiddenCount} hidden descendant${hiddenCount === 1 ? '' : 's'}` : 'Hide descendants'}
        >
          {isCollapsed ? (
            <>
              <Plus className="size-2.5" />
              {hiddenCount}
            </>
          ) : (
            <Minus className="size-2.5" />
          )}
        </button>
      )}
    </div>
  )
}
