"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CoupleFlowNode } from "../../utils/layout";
import { coupleStatusConfig } from "../../utils/coupleStatus";

// Handles anchor the auto-generated edges but aren't user-interactive. Hide with
// opacity only - keep the box size so edge endpoints stay centered on the node.
const hiddenHandle = "!size-2 !opacity-0";

export function CoupleNode({ data }: NodeProps<CoupleFlowNode>) {
  const {
    couple,
    onEdit,
    isCollapsed,
    hiddenCount,
    hasChildren,
    onToggleCollapse,
  } = data;

  const config = coupleStatusConfig[couple.status];
  const StatusIcon = config.icon;
  const year = couple.startDate ? new Date(couple.startDate).getFullYear() : null;
  const endYear = couple.endDate ? new Date(couple.endDate).getFullYear() : null;
  const isDivorced = couple.status === 'divorced';

  return (
    <div
      className={cn(
        "nodrag relative flex size-10 cursor-pointer items-center justify-center rounded-full border-2 shadow-sm transition-shadow hover:shadow-md",
        isCollapsed ? "border-primary bg-background" : config.bg,
      )}
      onClick={() => onEdit(couple.id)}
      title={`${couple.status} - click to edit`}
    >
      {year && (
        <span className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-medium text-muted-foreground">
          {isDivorced && endYear ? `m.${year}–${endYear}` : `m.${year}`}
        </span>
      )}
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className={hiddenHandle}
      />
      <Handle
        type="target"
        position={Position.Right}
        id="right"
        className={hiddenHandle}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className={hiddenHandle}
      />

      <StatusIcon
        className={cn("size-4", config.color)}
        fill="none"
        strokeWidth={1.75}
      />
      <span className="sr-only">{couple.status}</span>

      {hasChildren && (
        <button
          className={cn(
            "nodrag nopan absolute -bottom-7 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none shadow-sm transition-colors",
            isCollapsed
              ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
              : "border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground",
          )}
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse(`couple-${couple.id}`);
          }}
          title={
            isCollapsed
              ? `Show ${hiddenCount} hidden descendant${hiddenCount === 1 ? "" : "s"}`
              : "Hide descendants"
          }
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
  );
}
