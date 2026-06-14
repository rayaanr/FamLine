"use client";

import { getSmoothStepPath, BaseEdge, type EdgeProps } from "@xyflow/react";
import type { ParentChildFlowEdge } from "../../utils/layout";

const edgeStyles: Record<string, React.CSSProperties> = {
  biological: { stroke: "#64748b", strokeWidth: 2 },
  adopted: { stroke: "#8b5cf6", strokeWidth: 2, strokeDasharray: "6 4" },
  step: { stroke: "#f59e0b", strokeWidth: 2, strokeDasharray: "2 6" },
};

export function ParentChildEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}: EdgeProps<ParentChildFlowEdge>) {
  // Orthogonal routing: drop from the couple, run along a shared horizontal
  // "bus", then drop into each child - the classic family-tree look.
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 8,
  });

  const style = edgeStyles[data?.type ?? "biological"];

  return (
    <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />
  );
}
