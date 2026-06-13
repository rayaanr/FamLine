'use client'

import { Handle, Position, type NodeProps } from '@xyflow/react'
import {
  Minus, Plus, Heart, HeartCrack, Unlink, HeartHandshake,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CoupleFlowNode } from '../../utils/layout'

const statusColors: Record<string, string> = {
  married: 'text-green-500',
  divorced: 'text-red-500',
  separated: 'text-amber-500',
  partnered: 'text-blue-500',
}

const statusIcon: Record<string, LucideIcon> = {
  married: Heart,
  divorced: HeartCrack,
  separated: Unlink,
  partnered: HeartHandshake,
}

// Handles anchor the auto-generated edges but aren't user-interactive. Hide with
// opacity only — keep the box size so edge endpoints stay centered on the node.
const hiddenHandle = '!size-2 !opacity-0'

export function CoupleNode({ data }: NodeProps<CoupleFlowNode>) {
  const { couple, onEdit, isCollapsed, hiddenCount, hasChildren, onToggleCollapse } = data

  const StatusIcon = statusIcon[couple.status] ?? Heart

  return (
    <div
      className={cn(
        'nodrag relative flex size-10 cursor-pointer items-center justify-center rounded-full border-2 bg-background shadow-sm transition-shadow hover:shadow-md',
        isCollapsed ? 'border-primary' : 'border-border'
      )}
      onClick={() => onEdit(couple.id)}
      title={`${couple.status} — click to edit`}
    >
      <Handle type="target" position={Position.Left} id="left" className={hiddenHandle} />
      <Handle type="target" position={Position.Right} id="right" className={hiddenHandle} />
      <Handle type="source" position={Position.Bottom} id="bottom" className={hiddenHandle} />

      <StatusIcon className={cn('size-4', statusColors[couple.status])} fill="currentColor" />
      <span className="sr-only">{couple.status}</span>

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
