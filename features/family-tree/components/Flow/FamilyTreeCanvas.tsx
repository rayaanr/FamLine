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
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useFamilyStore } from '../../hooks/useFamilyStore'
import { useHydration } from '../../hooks/useHydration'
import { buildGraphFromTree, type NodeCallbacks } from '../../utils/layout'
import { PersonNode } from './PersonNode'
import { CoupleNode } from './CoupleNode'
import { SpouseEdge } from './SpouseEdge'
import { ParentChildEdge } from './ParentChildEdge'
import { FamilyTreeToolbar } from '../Toolbar/FamilyTreeToolbar'
import { FamilyTreeLegend } from '../Legend/FamilyTreeLegend'
import { AddPersonDialog } from '../dialogs/AddPersonDialog'
import { AddRelationshipDialog } from '../dialogs/AddRelationshipDialog'
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

type RelDialogState =
  | { open: false }
  | { open: true; mode: 'couple'; partnerId?: string }
  | { open: true; mode: 'parentChild'; parentId?: string; childId?: string }

export function FamilyTreeCanvas() {
  const hydrated = useHydration()

  const people = useFamilyStore((s) => s.people)
  const couples = useFamilyStore((s) => s.couples)
  const parentChildren = useFamilyStore((s) => s.parentChildren)
  const collapsedList = useFamilyStore((s) => s.collapsed)
  const toggleCollapse = useFamilyStore((s) => s.toggleCollapse)

  const collapsed = useMemo(() => new Set(collapsedList), [collapsedList])

  // Person dialog
  const [personDialog, setPersonDialog] = useState<{ open: boolean; edit?: Person }>({ open: false })

  // Relationship dialog — single state object covers all three entry points
  const [relDialog, setRelDialog] = useState<RelDialogState>({ open: false })

  const handleEditPerson = useCallback((id: string) => {
    const person = useFamilyStore.getState().people[id]
    if (person) setPersonDialog({ open: true, edit: person })
  }, [])

  const handleAddSpouse = useCallback((id: string) => {
    setRelDialog({ open: true, mode: 'couple', partnerId: id })
  }, [])

  const handleAddChild = useCallback((id: string) => {
    setRelDialog({ open: true, mode: 'parentChild', parentId: id })
  }, [])

  const handleAddParent = useCallback((id: string) => {
    setRelDialog({ open: true, mode: 'parentChild', childId: id })
  }, [])

  const handleEditCouple = useCallback((_id: string) => {}, [])

  const callbacks: NodeCallbacks = useMemo(
    () => ({
      onEditPerson: handleEditPerson,
      onAddSpouse: handleAddSpouse,
      onAddChild: handleAddChild,
      onAddParent: handleAddParent,
      onEditCouple: handleEditCouple,
      onToggleCollapse: toggleCollapse,
    }),
    [handleEditPerson, handleAddSpouse, handleAddChild, handleAddParent, handleEditCouple, toggleCollapse]
  )

  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(
    () => buildGraphFromTree({ people, couples, parentChildren }, callbacks, collapsed),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [people, couples, parentChildren, collapsed]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutEdges)

  useEffect(() => { setNodes(layoutNodes) }, [layoutNodes, setNodes])
  useEffect(() => { setEdges(layoutEdges) }, [layoutEdges, setEdges])

  const isEmpty = Object.keys(people).length === 0

  if (!hydrated) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    )
  }

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
            onAddPerson={() => setPersonDialog({ open: true })}
          />
        </Panel>

        <Panel position="top-right">
          <FamilyTreeLegend />
        </Panel>

        {isEmpty && (
          <Panel position="top-center">
            <div className="mt-20 flex flex-col items-center gap-3 text-center">
              <p className="text-2xl font-semibold text-foreground">Your family tree is empty</p>
              <p className="text-muted-foreground">
                Start by adding your first family member
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
    </>
  )
}
