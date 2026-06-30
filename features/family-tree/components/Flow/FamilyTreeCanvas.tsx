"use client";

import "@xyflow/react/dist/style.css";

import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type NodeTypes,
  type EdgeTypes,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryState } from "nuqs";
import { nanoid } from "nanoid";
import {
  useFamilyStore,
  useActiveTree,
  getActiveTree,
} from "../../hooks/useFamilyStore";
import { useTreeAccess } from "../../hooks/useTreeAccess";
import { ProfilePhotosProvider } from "../../hooks/useProfilePhotos";
import { buildGraphFromTree, type NodeCallbacks } from "../../utils/layout";
import { PersonNode } from "./PersonNode";
import { CoupleNode } from "./CoupleNode";
import { SpouseEdge } from "./SpouseEdge";
import { ParentChildEdge } from "./ParentChildEdge";
import { FamilyTreeToolbar } from "../Toolbar/FamilyTreeToolbar";
import { FamilyTreeLegend } from "../Legend/FamilyTreeLegend";
import { AddPersonDialog } from "../dialogs/AddPersonDialog";
import { AddRelationshipDialog } from "../dialogs/AddRelationshipDialog";
import { EditCoupleDialog } from "../dialogs/EditCoupleDialog";
import { PersonDetailSheet } from "../PersonDetailSheet";
import { personDisplayName } from "../../utils/person";
import { X } from "lucide-react";
import type { Person } from "../../types";

// Defined at module scope - React Flow requires stable references
const nodeTypes: NodeTypes = {
  person: PersonNode as NodeTypes[string],
  couple: CoupleNode as NodeTypes[string],
};

const edgeTypes: EdgeTypes = {
  spouse: SpouseEdge as EdgeTypes[string],
  parentChild: ParentChildEdge as EdgeTypes[string],
};

// Re-fits the view whenever the active tree changes. Must render inside
// <ReactFlow> so useReactFlow() has its provider.
function FitOnTreeChange({ treeId }: { treeId: string }) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    const t = setTimeout(() => fitView({ duration: 400, padding: 0.2 }), 60);
    return () => clearTimeout(t);
  }, [treeId, fitView]);
  return null;
}

// Drives the camera on each family swap. `center` names the person to zoom to
// (the one you swapped to); when null we fit the whole focused view. Keyed by a
// bumping `nonce` so the same target re-triggers. Runs after a short delay so
// the new layout has been committed to React Flow.
function SwapCamera({
  swap,
}: {
  swap: { nonce: number; center: string | null };
}) {
  const { fitView, setCenter, getNode } = useReactFlow();
  useEffect(() => {
    if (swap.nonce === 0) return;
    const t = setTimeout(() => {
      if (swap.center) {
        const node = getNode(`person-${swap.center}`);
        if (node) {
          const w = node.measured?.width ?? node.width ?? 200;
          const h = node.measured?.height ?? node.height ?? 64;
          setCenter(node.position.x + w / 2, node.position.y + h / 2, {
            zoom: 1,
            duration: 500,
          });
          return;
        }
      }
      fitView({ duration: 400, padding: 0.2 });
    }, 80);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swap.nonce]);
  return null;
}

type RelDialogState =
  | { open: false }
  | { open: true; mode: "couple"; partnerId?: string }
  | { open: true; mode: "parentChild"; parentId?: string; childId?: string };

export function FamilyTreeCanvas() {
  const { canEdit } = useTreeAccess();

  const tree = useActiveTree();
  const { people, couples, parentChildren, collapsed: collapsedList } = tree;
  const toggleCollapse = useFamilyStore((s) => s.toggleCollapse);
  const addPerson = useFamilyStore((s) => s.addPerson);
  const addCouple = useFamilyStore((s) => s.addCouple);
  const addParentChild = useFamilyStore((s) => s.addParentChild);

  const collapsed = useMemo(() => new Set(collapsedList), [collapsedList]);

  // Family-portal focus: which married-in person's family we're viewing. Local
  // (per-user, non-persisted) — it's a view swap, not a saved tree edit.
  const [focusId, setFocusId] = useState<string | null>(null);
  // Camera instruction for the next swap (zoom to a person, or fit the view).
  const [swap, setSwap] = useState<{ nonce: number; center: string | null }>({
    nonce: 0,
    center: null,
  });

  // Person dialog
  const [personDialog, setPersonDialog] = useState<{
    open: boolean;
    edit?: Person;
  }>({ open: false });

  // Relationship dialog - single state object covers all three entry points
  const [relDialog, setRelDialog] = useState<RelDialogState>({ open: false });

  // Edit couple dialog
  const [editCoupleId, setEditCoupleId] = useState<string | null>(null);

  // Selected person for the detail sheet (URL = source of truth via ?person=<id>)
  const [, setSelectedPerson] = useQueryState("person");

  const handleEditPerson = useCallback((id: string) => {
    const person = getActiveTree().people[id];
    if (person) setPersonDialog({ open: true, edit: person });
  }, []);

  const handleOpenDetails = useCallback(
    (id: string) => {
      setSelectedPerson(id);
    },
    [setSelectedPerson],
  );

  const handleAddSpouse = useCallback((id: string) => {
    setRelDialog({ open: true, mode: "couple", partnerId: id });
  }, []);

  const handleAddChild = useCallback((id: string) => {
    setRelDialog({ open: true, mode: "parentChild", parentId: id });
  }, []);

  const handleAddParent = useCallback((id: string) => {
    setRelDialog({ open: true, mode: "parentChild", childId: id });
  }, []);

  // One-click unknown relatives: create the placeholder person(s) and the
  // relationship together, no form. Fill in details later.
  const handleAddUnknown = useCallback(
    (id: string, kind: "partner" | "parents" | "child") => {
      const makePlaceholder = () => {
        const pid = nanoid();
        addPerson({
          id: pid,
          firstName: "",
          lastName: "",
          gender: "unknown",
          isDeceased: false,
          isPlaceholder: true,
        });
        return pid;
      };

      if (kind === "partner") {
        addCouple({
          id: nanoid(),
          partner1Id: id,
          partner2Id: makePlaceholder(),
          status: "married",
        });
      } else if (kind === "child") {
        addParentChild({
          id: nanoid(),
          childId: makePlaceholder(),
          singleParentId: id,
          type: "biological",
        });
      } else {
        const coupleId = nanoid();
        addCouple({
          id: coupleId,
          partner1Id: makePlaceholder(),
          partner2Id: makePlaceholder(),
          status: "married",
        });
        addParentChild({
          id: nanoid(),
          childId: id,
          coupleId,
          type: "biological",
        });
      }
    },
    [addPerson, addCouple, addParentChild],
  );

  const handleEditCouple = useCallback((id: string) => setEditCoupleId(id), []);

  const handleOpenFamily = useCallback(
    (id: string) => {
      // Clicking the spouse of the currently-focused person is the bridge back
      // to the family we came from: that spouse is bloodline of the full tree,
      // so return to it — but zoom straight to that person rather than fitting
      // the whole tree. Any other portal focuses that person's own family.
      const isSpouseOfFocus =
        focusId !== null &&
        Object.values(couples).some(
          (c) =>
            (c.partner1Id === focusId && c.partner2Id === id) ||
            (c.partner2Id === focusId && c.partner1Id === id),
        );
      if (isSpouseOfFocus) {
        // Return to the full tree, zoomed in on that person.
        setFocusId(null);
        setSwap((s) => ({ nonce: s.nonce + 1, center: id }));
      } else {
        // Open that person's family; fit the (small) family into view.
        setFocusId(id);
        setSwap((s) => ({ nonce: s.nonce + 1, center: null }));
      }
    },
    [focusId, couples],
  );

  const handleExitFocus = useCallback(() => {
    setFocusId(null);
    setSwap((s) => ({ nonce: s.nonce + 1, center: null }));
  }, []);

  const callbacks: NodeCallbacks = useMemo(
    () => ({
      onEditPerson: handleEditPerson,
      onOpenDetails: handleOpenDetails,
      onAddSpouse: handleAddSpouse,
      onAddChild: handleAddChild,
      onAddParent: handleAddParent,
      onAddUnknown: handleAddUnknown,
      onEditCouple: handleEditCouple,
      onToggleCollapse: toggleCollapse,
      onOpenFamily: handleOpenFamily,
    }),
    [
      handleEditPerson,
      handleOpenDetails,
      handleAddSpouse,
      handleAddChild,
      handleAddParent,
      handleAddUnknown,
      handleEditCouple,
      toggleCollapse,
      handleOpenFamily,
    ],
  );

  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(
    () => buildGraphFromTree(tree, callbacks, collapsed, focusId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [people, couples, parentChildren, collapsed, focusId],
  );

  const focusedPerson = focusId ? people[focusId] : undefined;

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutEdges);

  useEffect(() => {
    setNodes(layoutNodes);
  }, [layoutNodes, setNodes]);
  useEffect(() => {
    setEdges(layoutEdges);
  }, [layoutEdges, setEdges]);

  const isEmpty = Object.keys(people).length === 0;

  return (
    <ProfilePhotosProvider treeId={tree.id}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        proOptions={{ hideAttribution: true }}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        deleteKeyCode={null}
      >
        <FitOnTreeChange treeId={tree.id} />
        <SwapCamera swap={swap} />
        <Background />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            if (node.type === "couple") return "#94a3b8";
            const gender = (node.data as { person?: { gender?: string } })
              ?.person?.gender;
            if (gender === "male") return "#93c5fd";
            if (gender === "female") return "#f9a8d4";
            return "#e2e8f0";
          }}
          pannable
          zoomable
        />

        <Panel position="top-left">
          <FamilyTreeToolbar
            canEdit={canEdit}
            onAddPerson={() => setPersonDialog({ open: true })}
          />
        </Panel>

        <Panel position="top-right">
          <FamilyTreeLegend />
        </Panel>

        {focusedPerson && (
          <Panel position="top-center">
            <div className="flex items-center gap-3 rounded-full border border-border bg-background/95 py-1.5 pl-4 pr-1.5 shadow-md backdrop-blur">
              <span className="text-sm text-muted-foreground">
                Viewing{" "}
                <span className="font-semibold text-foreground">
                  {personDisplayName(focusedPerson)}
                </span>
                &apos;s family
              </span>
              <button
                onClick={handleExitFocus}
                className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted/70"
              >
                <X className="size-3" />
                Show full tree
              </button>
            </div>
          </Panel>
        )}

        {isEmpty && (
          <Panel position="top-center">
            <div className="mt-20 flex flex-col items-center gap-3 text-center">
              <p className="text-2xl font-semibold text-foreground">
                This family tree is empty
              </p>
              <p className="text-muted-foreground">
                {canEdit
                  ? "Start by adding your first family member"
                  : "No one has been added yet"}
              </p>
            </div>
          </Panel>
        )}
      </ReactFlow>

      <AddPersonDialog
        open={personDialog.open}
        onClose={() => setPersonDialog({ open: false })}
        editPerson={personDialog.edit}
      />

      <AddRelationshipDialog
        open={relDialog.open && relDialog.mode === "couple"}
        onClose={() => setRelDialog({ open: false })}
        mode="couple"
        preselectedPartnerId={
          relDialog.open && relDialog.mode === "couple"
            ? relDialog.partnerId
            : undefined
        }
      />

      <AddRelationshipDialog
        open={relDialog.open && relDialog.mode === "parentChild"}
        onClose={() => setRelDialog({ open: false })}
        mode="parentChild"
        preselectedParentId={
          relDialog.open && relDialog.mode === "parentChild"
            ? relDialog.parentId
            : undefined
        }
        preselectedChildId={
          relDialog.open && relDialog.mode === "parentChild"
            ? relDialog.childId
            : undefined
        }
      />

      <EditCoupleDialog
        coupleId={editCoupleId}
        onClose={() => setEditCoupleId(null)}
      />

      <PersonDetailSheet onEdit={handleEditPerson} />
    </ProfilePhotosProvider>
  );
}
