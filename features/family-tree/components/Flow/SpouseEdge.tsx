'use client'

import { getStraightPath, BaseEdge, type EdgeProps } from '@xyflow/react'
import type { SpouseFlowEdge } from '../../utils/layout'

export function SpouseEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  id,
  markerEnd,
}: EdgeProps<SpouseFlowEdge>) {
  const [edgePath] = getStraightPath({ sourceX, sourceY, targetX, targetY })

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      markerEnd={markerEnd}
      style={{ stroke: '#94a3b8', strokeWidth: 2 }}
    />
  )
}
