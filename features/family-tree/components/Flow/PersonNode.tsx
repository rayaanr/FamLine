"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  Plus,
  Heart,
  Baby,
  Crown,
  Minus,
  HelpCircle,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { calculateAge } from "../../utils/age";
import {
  personDisplayName,
  personInitials,
  isPlaceholderPerson,
} from "../../utils/person";
import { useTreeAccess } from "../../hooks/useTreeAccess";
import { useProfilePhotos } from "../../hooks/useProfilePhotos";
import type { PersonFlowNode } from "../../utils/layout";
import { genderConfig } from "../../utils/genderConfig";

// Handles still anchor the auto-generated edges, but they carry no meaning for
// the user (you don't draw connections by hand), so they're hidden with opacity
// only - their box must keep its size so edge endpoints stay centered.
const hiddenHandle = "!size-2.5 !opacity-0";

export function PersonNode({ data }: NodeProps<PersonFlowNode>) {
  const {
    person,
    onEdit,
    onOpenDetails,
    onAddSpouse,
    onAddChild,
    onAddParent,
    onAddUnknown,
    hasChildren,
    isCollapsed,
    hiddenCount,
    onToggleCollapse,
  } = data;

  const { canEdit } = useTreeAccess();
  const { photos } = useProfilePhotos();
  const photoUrl = photos[person.id];
  const isUnknown = isPlaceholderPerson(person);

  const birthYear = person.birthDate ? person.birthDate.slice(0, 4) : null;
  const deathYear = person.deathDate ? person.deathDate.slice(0, 4) : null;
  const dateStr = birthYear
    ? deathYear
      ? `${birthYear} – ${deathYear}`
      : `b. ${birthYear}`
    : null;

  const age = calculateAge(
    person.birthDate,
    person.isDeceased ? person.deathDate : undefined,
  );

  const gender = genderConfig[person.gender];
  const GenderIcon = gender.icon;

  return (
    <div
      onClick={() => onOpenDetails(person.id)}
      className={cn(
        "group relative flex h-16 w-50 cursor-pointer flex-col justify-center rounded-xl border-2 bg-card px-3 shadow-sm transition-shadow hover:shadow-md",
        gender.cardBg,
        isUnknown && "border-dashed bg-muted/40",
        person.isDeceased && "opacity-60",
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className={hiddenHandle}
      />
      {/* Both side handles are sources: a person is always the source of a spouse
          edge (couple node is the target), and a card can sit on either side. */}
      <Handle
        type="source"
        position={Position.Left}
        id="spouse-left"
        className={hiddenHandle}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="spouse-right"
        className={hiddenHandle}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className={hiddenHandle}
      />

      {canEdit && (
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(person.id); }}
          className="nodrag nopan absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-background/80 text-muted-foreground opacity-0 shadow-sm transition-opacity hover:text-foreground group-hover:opacity-100"
          title="Edit person"
        >
          <Pencil className="size-3" />
        </button>
      )}

      {/* Person info */}
      <div className="flex items-center gap-2.5">
        <Avatar className={cn("shrink-0", gender.avatarBg)}>
          {photoUrl && (
            <AvatarImage src={photoUrl} alt={personDisplayName(person)} />
          )}
          <AvatarFallback
            className={cn("font-semibold", gender.avatarBg)}
          >
            {personInitials(person)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p
              className={cn(
                "truncate text-sm font-semibold leading-tight text-foreground",
                isUnknown && "font-medium italic text-muted-foreground",
              )}
            >
              {personDisplayName(person)}
            </p>
            <GenderIcon
              className={cn(
                "size-3.5 shrink-0",
                gender.iconColor,
              )}
              aria-label={person.gender}
            />
          </div>
          {isUnknown ? (
            <p className="mt-0.5 text-xs text-muted-foreground/80">
              needs info
            </p>
          ) : (
            <>
              {(dateStr || age !== null) && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {dateStr}
                  {age !== null && (
                    <span className="text-muted-foreground/80">
                      {dateStr ? " · " : ""}
                      {person.isDeceased ? `aged ${age}` : `${age} yrs`}
                    </span>
                  )}
                </p>
              )}
              {person.isDeceased && !deathYear && !dateStr && (
                <p className="mt-0.5 text-xs text-muted-foreground">†</p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Bottom-border controls: + Add and collapse toggle. Editors only -
          collapse state is persisted, so viewers can't toggle it. */}
      {canEdit && (
        <div className="nodrag nopan absolute -bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1">
          <Popover>
            <PopoverTrigger
              onClick={(e) => e.stopPropagation()}
              className="flex size-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
              title="Add relative"
            >
              <Plus className="size-3.5" />
            </PopoverTrigger>
            <PopoverContent
              className="nodrag nopan w-52 p-1"
              side="bottom"
              align="center"
              onClick={(e) => e.stopPropagation()}
            >
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

              <div className="my-1 border-t border-border" />
              <p className="px-2.5 pb-1 pt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Don&apos;t know them yet?
              </p>
              <button
                onClick={() => onAddUnknown(person.id, "partner")}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <HelpCircle className="size-3.5 shrink-0" />
                Unknown partner
              </button>
              <button
                onClick={() => onAddUnknown(person.id, "parents")}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <HelpCircle className="size-3.5 shrink-0" />
                Unknown parents
              </button>
              <button
                onClick={() => onAddUnknown(person.id, "child")}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <HelpCircle className="size-3.5 shrink-0" />
                Unknown child
              </button>
            </PopoverContent>
          </Popover>

          {hasChildren && onToggleCollapse && (
            <button
              className={cn(
                "flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold leading-none shadow-sm transition-colors",
                isCollapsed
                  ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                  : "border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground",
              )}
              onClick={(e) => {
                e.stopPropagation();
                onToggleCollapse(`person-${person.id}`);
              }}
              title={
                isCollapsed ? `Show ${hiddenCount} hidden` : "Hide descendants"
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
      )}
    </div>
  );
}
