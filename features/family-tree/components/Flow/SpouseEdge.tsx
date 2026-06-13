'use client'

import { getStraightPath, BaseEdge, type EdgeProps } from '@xyflow/react'
import type { SpouseFlowEdge } from '../../utils/layout'

export function SpouseEdge({
  sourceX,
  sourceY,
  targetX,
  targetY,
  id,
}: EdgeProps<SpouseFlowEdge>) {
  const [edgePath] = getStraightPath({ sourceX, sourceY, targetX, targetY })

  // Plain connector — both partners link to the couple node symmetrically.
  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{ stroke: '#94a3b8', strokeWidth: 2 }}
    />
  )
}
