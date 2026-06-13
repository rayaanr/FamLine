'use client'

import { Handle, Position, type NodeProps } from '@xyflow/react'
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
  const { couple, onEdit } = data

  return (
    <div
      className="nodrag flex size-10 cursor-pointer items-center justify-center rounded-full border-2 border-border bg-background shadow-sm transition-shadow hover:shadow-md"
      onClick={() => onEdit(couple.id)}
      title={`${couple.status} — click to edit`}
    >
      {/* Left handle — receives partner1 or partner2 */}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!bg-slate-400 !w-2 !h-2 !border-background !border"
      />

      {/* Right handle — receives partner1 or partner2 */}
      <Handle
        type="target"
        position={Position.Right}
        id="right"
        className="!bg-slate-400 !w-2 !h-2 !border-background !border"
      />

      {/* Bottom handle — children go down from here */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="!bg-slate-400 !w-2 !h-2 !border-background !border"
      />

      <div className={cn('size-3 rounded-full', statusColors[couple.status])}>
        <span className="sr-only">{statusLabels[couple.status]}</span>
      </div>
    </div>
  )
}
