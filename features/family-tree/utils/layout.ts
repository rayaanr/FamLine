import type { Node, Edge } from '@xyflow/react'
import type { FamilyTree, Person, Couple, ParentChildType } from '../types'

const PERSON_W = 200
const PERSON_H = 100
const COUPLE_W = 40
const COUPLE_H = 40
const H_GAP = 120
const V_GAP = 180

export interface PersonNodeData extends Record<string, unknown> {
  person: Person
  onEdit: (id: string) => void
  onAddSpouse: (id: string) => void
  onAddChild: (id: string) => void
  onAddParent: (id: string) => void
}

export interface CoupleNodeData extends Record<string, unknown> {
  couple: Couple
  onEdit: (id: string) => void
}

export type PersonFlowNode = Node<PersonNodeData, 'person'>
export type CoupleFlowNode = Node<CoupleNodeData, 'couple'>
export type AppNode = PersonFlowNode | CoupleFlowNode

export type SpouseEdgeData = Record<string, never>
export interface ParentChildEdgeData extends Record<string, unknown> {
  type: ParentChildType
}

export type SpouseFlowEdge = Edge<SpouseEdgeData, 'spouse'>
export type ParentChildFlowEdge = Edge<ParentChildEdgeData, 'parentChild'>
export type AppEdge = SpouseFlowEdge | ParentChildFlowEdge

export interface NodeCallbacks {
  onEditPerson: (id: string) => void
  onAddSpouse: (id: string) => void
  onAddChild: (id: string) => void
  onAddParent: (id: string) => void
  onEditCouple: (id: string) => void
}

export function buildGraphFromTree(
  tree: FamilyTree,
  callbacks: NodeCallbacks
): { nodes: AppNode[]; edges: AppEdge[] } {
  const { people, couples, parentChildren } = tree

  if (Object.keys(people).length === 0) {
    return { nodes: [], edges: [] }
  }

  // Build lookup maps
  const childToParentCouples = new Map<string, string[]>()
  const coupleToChildren = new Map<string, string[]>()
  const personToCouples = new Map<string, string[]>()

  for (const pc of Object.values(parentChildren)) {
    if (pc.coupleId) {
      const arr = childToParentCouples.get(pc.childId) ?? []
      arr.push(pc.coupleId)
      childToParentCouples.set(pc.childId, arr)

      const children = coupleToChildren.get(pc.coupleId) ?? []
      children.push(pc.childId)
      coupleToChildren.set(pc.coupleId, children)
    }
  }

  for (const c of Object.values(couples)) {
    for (const pid of [c.partner1Id, c.partner2Id]) {
      const arr = personToCouples.get(pid) ?? []
      arr.push(c.id)
      personToCouples.set(pid, arr)
    }
  }

  // Assign generations via BFS
  const generations = new Map<string, number>()
  const rootPeople = Object.keys(people).filter(
    (id) => !childToParentCouples.has(id) || childToParentCouples.get(id)!.length === 0
  )

  const queue: string[] = [...rootPeople]
  rootPeople.forEach((id) => generations.set(id, 0))

  while (queue.length > 0) {
    const personId = queue.shift()!
    const gen = generations.get(personId)!
    const myCouples = personToCouples.get(personId) ?? []

    for (const coupleId of myCouples) {
      const couple = couples[coupleId]
      if (!couple) continue
      const children = coupleToChildren.get(coupleId) ?? []

      for (const childId of children) {
        if (!generations.has(childId)) {
          const p1Gen = generations.get(couple.partner1Id) ?? gen
          const p2Gen = generations.get(couple.partner2Id) ?? gen
          const childGen = Math.max(p1Gen, p2Gen) + 1
          generations.set(childId, childGen)
          queue.push(childId)
        }
      }
    }
  }

  // Assign generation 0 to anyone not yet reached (isolated nodes, singleParent children)
  for (const id of Object.keys(people)) {
    if (!generations.has(id)) generations.set(id, 0)
  }

  // Group people by generation and sort within each generation
  const byGeneration = new Map<number, string[]>()
  generations.forEach((gen, id) => {
    const arr = byGeneration.get(gen) ?? []
    arr.push(id)
    byGeneration.set(gen, arr)
  })

  // Order people within each generation so partners are adjacent
  byGeneration.forEach((ids, gen) => {
    byGeneration.set(gen, orderPeopleInGeneration(ids, couples, personToCouples))
  })

  // Assign X positions per generation
  const personPositions = new Map<string, { x: number; y: number }>()

  byGeneration.forEach((personIds, gen) => {
    const y = gen * (PERSON_H + V_GAP)
    const totalWidth = personIds.length * PERSON_W + Math.max(0, personIds.length - 1) * H_GAP
    const startX = -totalWidth / 2

    personIds.forEach((id, idx) => {
      const x = startX + idx * (PERSON_W + H_GAP)
      personPositions.set(id, { x, y })
    })
  })

  const nodes: AppNode[] = []
  const edges: AppEdge[] = []

  // Person nodes
  for (const person of Object.values(people)) {
    const pos = personPositions.get(person.id) ?? { x: 0, y: 0 }
    nodes.push({
      id: `person-${person.id}`,
      type: 'person',
      position: pos,
      data: {
        person,
        onEdit: callbacks.onEditPerson,
        onAddSpouse: callbacks.onAddSpouse,
        onAddChild: callbacks.onAddChild,
        onAddParent: callbacks.onAddParent,
      },
    })
  }

  // Couple nodes + spouse edges
  for (const couple of Object.values(couples)) {
    const p1Pos = personPositions.get(couple.partner1Id)
    const p2Pos = personPositions.get(couple.partner2Id)

    if (!p1Pos || !p2Pos) continue

    const p1CenterX = p1Pos.x + PERSON_W / 2
    const p2CenterX = p2Pos.x + PERSON_W / 2
    const p1CenterY = p1Pos.y + PERSON_H / 2
    const p2CenterY = p2Pos.y + PERSON_H / 2

    const coupleX = (p1CenterX + p2CenterX) / 2 - COUPLE_W / 2
    const coupleY = (p1CenterY + p2CenterY) / 2 - COUPLE_H / 2

    nodes.push({
      id: `couple-${couple.id}`,
      type: 'couple',
      position: { x: coupleX, y: coupleY },
      data: {
        couple,
        onEdit: callbacks.onEditCouple,
      },
    })

    const p1IsLeft = p1CenterX <= p2CenterX

    edges.push({
      id: `spouse-${couple.id}-p1`,
      type: 'spouse',
      source: `person-${couple.partner1Id}`,
      sourceHandle: p1IsLeft ? 'spouse-right' : 'spouse-left',
      target: `couple-${couple.id}`,
      targetHandle: p1IsLeft ? 'left' : 'right',
      data: {},
    } as SpouseFlowEdge)

    edges.push({
      id: `spouse-${couple.id}-p2`,
      type: 'spouse',
      source: `person-${couple.partner2Id}`,
      sourceHandle: p1IsLeft ? 'spouse-left' : 'spouse-right',
      target: `couple-${couple.id}`,
      targetHandle: p1IsLeft ? 'right' : 'left',
      data: {},
    } as SpouseFlowEdge)
  }

  // Parent-child edges
  for (const pc of Object.values(parentChildren)) {
    if (pc.coupleId && couples[pc.coupleId]) {
      edges.push({
        id: `parentchild-${pc.id}`,
        type: 'parentChild',
        source: `couple-${pc.coupleId}`,
        target: `person-${pc.childId}`,
        data: { type: pc.type },
      } as ParentChildFlowEdge)
    } else if (pc.singleParentId && people[pc.singleParentId]) {
      edges.push({
        id: `parentchild-${pc.id}`,
        type: 'parentChild',
        source: `person-${pc.singleParentId}`,
        target: `person-${pc.childId}`,
        data: { type: pc.type },
      } as ParentChildFlowEdge)
    }
  }

  return { nodes, edges }
}

function orderPeopleInGeneration(
  ids: string[],
  couples: Record<string, Couple>,
  personToCouples: Map<string, string[]>
): string[] {
  const ordered: string[] = []
  const placed = new Set<string>()

  for (const id of ids) {
    if (placed.has(id)) continue
    ordered.push(id)
    placed.add(id)

    // Place this person's partner(s) adjacent
    const myCouples = personToCouples.get(id) ?? []
    for (const coupleId of myCouples) {
      const couple = couples[coupleId]
      if (!couple) continue
      const partnerId =
        couple.partner1Id === id ? couple.partner2Id : couple.partner1Id
      if (!placed.has(partnerId) && ids.includes(partnerId)) {
        ordered.push(partnerId)
        placed.add(partnerId)
      }
    }
  }

  return ordered
}
