'use client'

import '@xyflow/react/dist/style.css'

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
} from '@xyflow/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQueryState } from 'nuqs'
import { nanoid } from 'nanoid'
import { useFamilyStore, useActiveTree, getActiveTree } from '../../hooks/useFamilyStore'
import { useTreeAccess } from '../../hooks/useTreeAccess'
import { buildGraphFromTree, type NodeCallbacks } from '../../utils/layout'
import { PersonNode } from './PersonNode'
import { CoupleNode } from './CoupleNode'
import { SpouseEdge } from './SpouseEdge'
import { ParentChildEdge } from './ParentChildEdge'
import { FamilyTreeToolbar } from '../Toolbar/FamilyTreeToolbar'
import { FamilyTreeLegend } from '../Legend/FamilyTreeLegend'
import { AddPersonDialog } from '../dialogs/AddPersonDialog'
import { AddRelationshipDialog } from '../dialogs/AddRelationshipDialog'
import { PersonDetailSheet } from '../PersonDetailSheet'
import type { Person } from '../../types'

// Defined at module scope — React Flow requires stable references
const nodeTypes: NodeTypes = {
  person: PersonNode as NodeTypes[string],
  couple: CoupleNode as NodeTypes[string],
}

const edgeTypes: EdgeTypes = {
  spouse: SpouseEdge as EdgeTypes[string],
  parentChild: ParentChildEdge as EdgeTypes[string],
}

// Re-fits the view whenever the active tree changes. Must render inside
// <ReactFlow> so useReactFlow() has its provider.
function FitOnTreeChange({ treeId }: { treeId: string }) {
  const { fitView } = useReactFlow()
  useEffect(() => {
    const t = setTimeout(() => fitView({ duration: 400, padding: 0.2 }), 60)
    return () => clearTimeout(t)
  }, [treeId, fitView])
  return null
}

type RelDialogState =
  | { open: false }
  | { open: true; mode: 'couple'; partnerId?: string }
  | { open: true; mode: 'parentChild'; parentId?: string; childId?: string }

export function FamilyTreeCanvas() {
  const { canEdit } = useTreeAccess()

  const tree = useActiveTree()
  const { people, couples, parentChildren, collapsed: collapsedList } = tree
  const toggleCollapse = useFamilyStore((s) => s.toggleCollapse)
  const addPerson = useFamilyStore((s) => s.addPerson)
  const addCouple = useFamilyStore((s) => s.addCouple)
  const addParentChild = useFamilyStore((s) => s.addParentChild)

  const collapsed = useMemo(() => new Set(collapsedList), [collapsedList])

  // Person dialog
  const [personDialog, setPersonDialog] = useState<{ open: boolean; edit?: Person }>({ open: false })

  // Relationship dialog — single state object covers all three entry points
  const [relDialog, setRelDialog] = useState<RelDialogState>({ open: false })

  // Selected person for the detail sheet (URL = source of truth via ?person=<id>)
  const [, setSelectedPerson] = useQueryState('person')

  const handleEditPerson = useCallback((id: string) => {
    const person = getActiveTree().people[id]
    if (person) setPersonDialog({ open: true, edit: person })
  }, [])

  const handleOpenDetails = useCallback((id: string) => {
    setSelectedPerson(id)
  }, [setSelectedPerson])

  const handleAddSpouse = useCallback((id: string) => {
    setRelDialog({ open: true, mode: 'couple', partnerId: id })
  }, [])

  const handleAddChild = useCallback((id: string) => {
    setRelDialog({ open: true, mode: 'parentChild', parentId: id })
  }, [])

  const handleAddParent = useCallback((id: string) => {
    setRelDialog({ open: true, mode: 'parentChild', childId: id })
  }, [])

  // One-click unknown relatives: create the placeholder person(s) and the
  // relationship together, no form. Fill in details later.
  const handleAddUnknown = useCallback(
    (id: string, kind: 'partner' | 'parents' | 'child') => {
      const makePlaceholder = () => {
        const pid = nanoid()
        addPerson({
          id: pid,
          firstName: '',
          lastName: '',
          gender: 'unknown',
          isDeceased: false,
          isPlaceholder: true,
        })
        return pid
      }

      if (kind === 'partner') {
        addCouple({ id: nanoid(), partner1Id: id, partner2Id: makePlaceholder(), status: 'married' })
      } else if (kind === 'child') {
        addParentChild({ id: nanoid(), childId: makePlaceholder(), singleParentId: id, type: 'biological' })
      } else {
        const coupleId = nanoid()
        addCouple({ id: coupleId, partner1Id: makePlaceholder(), partner2Id: makePlaceholder(), status: 'married' })
        addParentChild({ id: nanoid(), childId: id, coupleId, type: 'biological' })
      }
    },
    [addPerson, addCouple, addParentChild]
  )

  const handleEditCouple = useCallback((_id: string) => {}, [])

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
    }),
    [handleEditPerson, handleOpenDetails, handleAddSpouse, handleAddChild, handleAddParent, handleAddUnknown, handleEditCouple, toggleCollapse]
  )

  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(
    () => buildGraphFromTree(tree, callbacks, collapsed),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [people, couples, parentChildren, collapsed]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutEdges)

  useEffect(() => { setNodes(layoutNodes) }, [layoutNodes, setNodes])
  useEffect(() => { setEdges(layoutEdges) }, [layoutEdges, setEdges])

  const isEmpty = Object.keys(people).length === 0

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        deleteKeyCode={null}
      >
        <FitOnTreeChange treeId={tree.id} />
        <Background />
        <Controls />
        <MiniMap
          nodeColor={(node) => {
            if (node.type === 'couple') return '#94a3b8'
            const gender = (node.data as { person?: { gender?: string } })?.person?.gender
            if (gender === 'male') return '#93c5fd'
            if (gender === 'female') return '#f9a8d4'
            return '#e2e8f0'
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

        {isEmpty && (
          <Panel position="top-center">
            <div className="mt-20 flex flex-col items-center gap-3 text-center">
              <p className="text-2xl font-semibold text-foreground">This family tree is empty</p>
              <p className="text-muted-foreground">
                {canEdit
                  ? 'Start by adding your first family member'
                  : 'No one has been added yet'}
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
        open={relDialog.open && relDialog.mode === 'couple'}
        onClose={() => setRelDialog({ open: false })}
        mode="couple"
        preselectedPartnerId={relDialog.open && relDialog.mode === 'couple' ? relDialog.partnerId : undefined}
      />

      <AddRelationshipDialog
        open={relDialog.open && relDialog.mode === 'parentChild'}
        onClose={() => setRelDialog({ open: false })}
        mode="parentChild"
        preselectedParentId={relDialog.open && relDialog.mode === 'parentChild' ? relDialog.parentId : undefined}
        preselectedChildId={relDialog.open && relDialog.mode === 'parentChild' ? relDialog.childId : undefined}
      />

      <PersonDetailSheet onEdit={handleEditPerson} />
    </>
  )
}
