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

export function FamilyTreeCanvas() {
  const hydrated = useHydration()

  // Store selectors
  const people = useFamilyStore((s) => s.people)
  const couples = useFamilyStore((s) => s.couples)
  const parentChildren = useFamilyStore((s) => s.parentChildren)

  // Dialog state
  const [addPersonOpen, setAddPersonOpen] = useState(false)
  const [editPerson, setEditPerson] = useState<Person | undefined>()

  const [addCoupleOpen, setAddCoupleOpen] = useState(false)
  const [addParentChildOpen, setAddParentChildOpen] = useState(false)
  const [preselectedPersonId, setPreselectedPersonId] = useState<string | undefined>()

  // Stable callbacks for node actions
  const handleEditPerson = useCallback((id: string) => {
    const person = useFamilyStore.getState().people[id]
    if (person) {
      setEditPerson(person)
      setAddPersonOpen(true)
    }
  }, [])

  const handleAddSpouse = useCallback((id: string) => {
    setPreselectedPersonId(id)
    setAddCoupleOpen(true)
  }, [])

  const handleAddChild = useCallback((id: string) => {
    setPreselectedPersonId(id)
    setAddParentChildOpen(true)
  }, [])

  const handleEditCouple = useCallback((_id: string) => {
    // Future: open edit couple dialog
  }, [])

  const callbacks: NodeCallbacks = useMemo(
    () => ({
      onEditPerson: handleEditPerson,
      onAddSpouse: handleAddSpouse,
      onAddChild: handleAddChild,
      onEditCouple: handleEditCouple,
    }),
    [handleEditPerson, handleAddSpouse, handleAddChild, handleEditCouple]
  )

  // Build layout from store data
  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(
    () => buildGraphFromTree({ people, couples, parentChildren }, callbacks),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [people, couples, parentChildren]
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutEdges)

  // Sync layout changes back into React Flow state
  useEffect(() => {
    setNodes(layoutNodes)
  }, [layoutNodes, setNodes])

  useEffect(() => {
    setEdges(layoutEdges)
  }, [layoutEdges, setEdges])

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
            onAddPerson={() => {
              setEditPerson(undefined)
              setAddPersonOpen(true)
            }}
            onAddCouple={() => {
              setPreselectedPersonId(undefined)
              setAddCoupleOpen(true)
            }}
            onAddParentChild={() => {
              setPreselectedPersonId(undefined)
              setAddParentChildOpen(true)
            }}
          />
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
        open={addPersonOpen}
        onClose={() => {
          setAddPersonOpen(false)
          setEditPerson(undefined)
        }}
        editPerson={editPerson}
      />

      <AddRelationshipDialog
        open={addCoupleOpen}
        onClose={() => setAddCoupleOpen(false)}
        mode="couple"
        preselectedPersonId={preselectedPersonId}
      />

      <AddRelationshipDialog
        open={addParentChildOpen}
        onClose={() => setAddParentChildOpen(false)}
        mode="parentChild"
        preselectedPersonId={preselectedPersonId}
      />
    </>
  )
}
