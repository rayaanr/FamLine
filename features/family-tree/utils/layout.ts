import type { Node, Edge } from '@xyflow/react'
import type { FamilyTree, Person, Couple, ParentChildType } from '../types'

// ── Dimensions & spacing ──────────────────────────────────────────────────────
const PERSON_W = 200
const PERSON_H = 92
const COUPLE_W = 40
const COUPLE_H = 40
const SPOUSE_GAP = 56   // gap between two partner cards (couple node sits in it)
const SIBLING_GAP = 48  // horizontal gap between sibling subtrees
const ROW_GAP = 110     // vertical gap between generations
const ROOT_GAP = 140    // horizontal gap between separate family trees
const ROW_H = PERSON_H + ROW_GAP

// Distance from a couple node's center to each partner's card center.
// Partners are kept directly adjacent with the couple node in the gap between.
const PARTNER_OFFSET = PERSON_W / 2 + SPOUSE_GAP / 2

export interface PersonNodeData extends Record<string, unknown> {
  person: Person
  onEdit: (id: string) => void
  onAddSpouse: (id: string) => void
  onAddChild: (id: string) => void
  onAddParent: (id: string) => void
  // Set only for single parents who have children (collapse-by-person).
  isCollapsed?: boolean
  hiddenCount?: number
  hasChildren?: boolean
  onToggleCollapse?: (nodeId: string) => void
}

export interface CoupleNodeData extends Record<string, unknown> {
  couple: Couple
  onEdit: (id: string) => void
  isCollapsed: boolean
  hiddenCount: number
  hasChildren: boolean
  onToggleCollapse: (nodeId: string) => void
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
  onToggleCollapse: (nodeId: string) => void
}

interface Point {
  x: number
  y: number
}

export function buildGraphFromTree(
  tree: FamilyTree,
  callbacks: NodeCallbacks,
  collapsed: Set<string> = new Set()
): { nodes: AppNode[]; edges: AppEdge[] } {
  const { people, couples, parentChildren } = tree

  if (Object.keys(people).length === 0) return { nodes: [], edges: [] }

  // ── Lookup maps ────────────────────────────────────────────────────────────
  const coupleChildren = new Map<string, string[]>()      // coupleId  → childIds
  const personCouples = new Map<string, string[]>()       // personId  → coupleIds
  const singleParentChildren = new Map<string, string[]>() // parentId → childIds
  const childHasParents = new Set<string>()

  for (const c of Object.values(couples)) {
    for (const pid of [c.partner1Id, c.partner2Id]) {
      personCouples.set(pid, [...(personCouples.get(pid) ?? []), c.id])
    }
  }

  for (const pc of Object.values(parentChildren)) {
    if (pc.coupleId && couples[pc.coupleId]) {
      coupleChildren.set(pc.coupleId, [...(coupleChildren.get(pc.coupleId) ?? []), pc.childId])
      childHasParents.add(pc.childId)
    } else if (pc.singleParentId && people[pc.singleParentId]) {
      singleParentChildren.set(pc.singleParentId, [
        ...(singleParentChildren.get(pc.singleParentId) ?? []),
        pc.childId,
      ])
      childHasParents.add(pc.childId)
    }
  }

  const childrenOf = (coupleId: string) => coupleChildren.get(coupleId) ?? []
  const couplesOf = (personId: string) => personCouples.get(personId) ?? []
  const soleChildrenOf = (personId: string) => singleParentChildren.get(personId) ?? []
  const isParentless = (id: string) => !childHasParents.has(id)
  const otherPartner = (couple: Couple, id: string) =>
    couple.partner1Id === id ? couple.partner2Id : couple.partner1Id

  // ── Collapse: a collapsed point lays out as a leaf (no descendants) ──────────
  const coupleCollapsed = (coupleId: string) => collapsed.has(`couple-${coupleId}`)
  const personCollapsed = (personId: string) => collapsed.has(`person-${personId}`)
  const visibleChildrenOf = (coupleId: string) =>
    coupleCollapsed(coupleId) ? [] : childrenOf(coupleId)
  const visibleSoleChildrenOf = (personId: string) =>
    personCollapsed(personId) ? [] : soleChildrenOf(personId)

  // Number of people hidden when a branch is collapsed (the whole subtree below
  // it). Walks the raw maps; `seen` guards against the rare shared-descendant DAG.
  const countCoupleDescendants = (coupleId: string, seen: Set<string>): number => {
    let n = 0
    for (const childId of childrenOf(coupleId)) {
      if (seen.has(childId)) continue
      seen.add(childId)
      n += 1
      for (const cid of couplesOf(childId)) {
        const spouse = otherPartner(couples[cid], childId)
        if (!seen.has(spouse)) { seen.add(spouse); n += 1 }
        n += countCoupleDescendants(cid, seen)
      }
      n += countPersonDescendants(childId, seen)
    }
    return n
  }
  const countPersonDescendants = (personId: string, seen: Set<string>): number => {
    let n = 0
    for (const childId of soleChildrenOf(personId)) {
      if (seen.has(childId)) continue
      seen.add(childId)
      n += 1
      for (const cid of couplesOf(childId)) {
        const spouse = otherPartner(couples[cid], childId)
        if (!seen.has(spouse)) { seen.add(spouse); n += 1 }
        n += countCoupleDescendants(cid, seen)
      }
      n += countPersonDescendants(childId, seen)
    }
    return n
  }

  // ── Generations via constraint relaxation ──────────────────────────────────
  // Two constraints, relaxed until stable:
  //   • both partners of a couple share a generation (the deeper one wins)
  //   • a child sits one generation below its parents
  // This correctly pulls "married-in" spouses down to their partner's row,
  // instead of stranding them at generation 0 just because they have no parents.
  const generation = new Map<string, number>()
  for (const id of Object.keys(people)) generation.set(id, 0)

  const coupleGen = (c: Couple) =>
    Math.max(generation.get(c.partner1Id) ?? 0, generation.get(c.partner2Id) ?? 0)

  let changed = true
  let guard = Object.keys(people).length + Object.keys(couples).length + 2
  while (changed && guard-- > 0) {
    changed = false

    for (const c of Object.values(couples)) {
      const g = coupleGen(c)
      if (generation.get(c.partner1Id) !== g) { generation.set(c.partner1Id, g); changed = true }
      if (generation.get(c.partner2Id) !== g) { generation.set(c.partner2Id, g); changed = true }
    }

    for (const pc of Object.values(parentChildren)) {
      const parentGen = pc.coupleId && couples[pc.coupleId]
        ? coupleGen(couples[pc.coupleId])
        : pc.singleParentId && people[pc.singleParentId]
          ? generation.get(pc.singleParentId) ?? 0
          : undefined
      if (parentGen === undefined) continue
      if ((generation.get(pc.childId) ?? 0) < parentGen + 1) {
        generation.set(pc.childId, parentGen + 1)
        changed = true
      }
    }
  }

  // ── Recursive placement ────────────────────────────────────────────────────
  const personPos = new Map<string, Point>()  // top-left of person nodes
  const couplePos = new Map<string, Point>()  // top-left of couple nodes
  const placed = new Set<string>()

  const rowY = (id: string) => (generation.get(id) ?? 0) * ROW_H
  const setPersonCenter = (id: string, cx: number) =>
    personPos.set(id, { x: cx - PERSON_W / 2, y: rowY(id) })
  const setCoupleCenter = (coupleId: string, cx: number, partnerId: string) =>
    couplePos.set(coupleId, {
      x: cx - COUPLE_W / 2,
      y: rowY(partnerId) + (PERSON_H - COUPLE_H) / 2,
    })

  // Width of a horizontal band of sibling subtrees.
  const bandWidth = (ids: string[]): number => {
    if (ids.length === 0) return 0
    return ids.reduce((w, id) => w + measure(id), 0) + SIBLING_GAP * (ids.length - 1)
  }

  // measure(personId) → total horizontal extent of this person's whole block
  // (the person, every spouse, and all descendants). Memoised. Always an
  // upper bound on what place() consumes, so siblings never overlap.
  const widthMemo = new Map<string, number>()
  const measure = (id: string): number => {
    const cached = widthMemo.get(id)
    if (cached !== undefined) return cached
    widthMemo.set(id, PERSON_W) // break cycles defensively

    const couples = couplesOf(id)
    const soleKids = visibleSoleChildrenOf(id)

    let width: number

    if (couples.length === 0) {
      width = soleKids.length ? Math.max(PERSON_W, bandWidth(soleKids)) : PERSON_W
    } else if (couples.length === 1) {
      const band = bandWidth(visibleChildrenOf(couples[0]))
      const topRow = 2 * PERSON_W + 2 * SPOUSE_GAP + COUPLE_W
      width = Math.max(band, topRow)
    } else {
      // Multiple marriages: spouse · ♥ · person · ♥ · spouse · …
      // (partners stay adjacent; children of each couple hang under its node)
      const topRow =
        (couples.length + 1) * PERSON_W +
        couples.length * SPOUSE_GAP +
        Math.max(0, couples.length - 1) * COUPLE_W
      const groups = couples
        .map((cid) => bandWidth(visibleChildrenOf(cid)))
        .filter((w) => w > 0)
      const kidsTotal =
        groups.reduce((a, b) => a + b, 0) +
        Math.max(0, groups.length - 1) * SIBLING_GAP
      width = Math.max(topRow, kidsTotal)
    }

    // Fold in any single-parent children that hang directly off this person.
    if (couples.length > 0 && soleKids.length) {
      width = Math.max(width, bandWidth(soleKids))
    }

    widthMemo.set(id, width)
    return width
  }

  // place(personId, leftX) → assigns coordinates; returns the block width.
  const place = (id: string, leftX: number): number => {
    if (placed.has(id)) return 0
    placed.add(id)

    const width = measure(id)
    const center = leftX + width / 2
    const couples = couplesOf(id)
    const soleKids = visibleSoleChildrenOf(id)

    const placeBand = (ids: string[], bandLeftX: number) => {
      let cursor = bandLeftX
      for (const childId of ids) {
        cursor += place(childId, cursor) + SIBLING_GAP
      }
    }

    if (couples.length === 0) {
      if (soleKids.length) {
        const bw = bandWidth(soleKids)
        placeBand(soleKids, center - bw / 2)
      }
      setPersonCenter(id, center)
      return width
    }

    if (couples.length === 1) {
      const couple = couples[0]
      const spouse = otherPartner(tree.couples[couple], id)
      placed.add(spouse)

      const kids = visibleChildrenOf(couple)
      const bw = bandWidth(kids)
      if (kids.length) placeBand(kids, center - bw / 2)

      // Couple node centered in the block (and over the children band).
      setCoupleCenter(couple, center, id)
      setPersonCenter(id, center - PARTNER_OFFSET)
      setPersonCenter(spouse, center + PARTNER_OFFSET)
    } else {
      // Multiple marriages — keep the shared person flanked by their partners:
      //   [spouse1] ♥ [person] ♥ [spouse2]
      // First couple sits to the left of the person, the rest to the right.
      setPersonCenter(id, center)

      const firstSpouse = otherPartner(tree.couples[couples[0]], id)
      placed.add(firstSpouse)
      setCoupleCenter(couples[0], center - PARTNER_OFFSET, id)
      setPersonCenter(firstSpouse, center - 2 * PARTNER_OFFSET)

      let rc = center + PARTNER_OFFSET // first right-hand couple node
      for (let j = 1; j < couples.length; j++) {
        const spouse = otherPartner(tree.couples[couples[j]], id)
        placed.add(spouse)
        setCoupleCenter(couples[j], rc, id)
        setPersonCenter(spouse, rc + PARTNER_OFFSET)
        rc += 2 * PARTNER_OFFSET + COUPLE_W
      }

      // All children form one band centered under the person, grouped by couple
      // so each couple node sits above its own kids.
      const groups = couples
        .map((cid) => ({ kids: visibleChildrenOf(cid), w: bandWidth(visibleChildrenOf(cid)) }))
        .filter((g) => g.kids.length)
      const kidsTotal =
        groups.reduce((a, g) => a + g.w, 0) +
        Math.max(0, groups.length - 1) * SIBLING_GAP
      let kc = center - kidsTotal / 2
      for (const g of groups) {
        placeBand(g.kids, kc)
        kc += g.w + SIBLING_GAP
      }
    }

    // Single-parent children of this person hang below them.
    if (soleKids.length) {
      const bw = bandWidth(soleKids)
      placeBand(soleKids, center - bw / 2)
    }

    return width
  }

  // Everyone living below a collapsed point — they must not be placed at all
  // (otherwise the safety net below would re-add them as stray roots).
  const hidden = new Set<string>()
  for (const key of collapsed) {
    if (key.startsWith('couple-')) countCoupleDescendants(key.slice('couple-'.length), hidden)
    else if (key.startsWith('person-')) countPersonDescendants(key.slice('person-'.length), hidden)
  }

  // ── Choose roots & run placement ────────────────────────────────────────────
  // Founding couples (both partners parentless) anchor whole trees; descend
  // from one partner so the other is placed as a spouse.
  let rootCursor = 0
  for (const c of Object.values(couples)) {
    if (placed.has(c.partner1Id) || placed.has(c.partner2Id)) continue
    if (isParentless(c.partner1Id) && isParentless(c.partner2Id)) {
      rootCursor += place(c.partner1Id, rootCursor) + ROOT_GAP
    }
  }
  // Remaining parentless people: single founders, or spouses not yet reached.
  for (const id of Object.keys(people)) {
    if (placed.has(id) || hidden.has(id) || !isParentless(id)) continue
    rootCursor += place(id, rootCursor) + ROOT_GAP
  }
  // Safety net for anything left (cycles, orphaned records) — but never resurrect
  // people hidden inside a collapsed branch.
  for (const id of Object.keys(people)) {
    if (placed.has(id) || hidden.has(id)) continue
    rootCursor += place(id, rootCursor) + ROOT_GAP
  }

  // ── Build nodes ──────────────────────────────────────────────────────────────
  const nodes: AppNode[] = []
  const edges: AppEdge[] = []

  for (const person of Object.values(people)) {
    const pos = personPos.get(person.id)
    if (!pos) continue // hidden inside a collapsed branch
    const hasSoleKids = soleChildrenOf(person.id).length > 0
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
        hasChildren: hasSoleKids,
        isCollapsed: personCollapsed(person.id),
        hiddenCount: hasSoleKids
          ? countPersonDescendants(person.id, new Set([person.id]))
          : 0,
        onToggleCollapse: callbacks.onToggleCollapse,
      },
    })
  }

  for (const couple of Object.values(couples)) {
    const pos = couplePos.get(couple.id)
    if (!pos) continue
    const hasKids = childrenOf(couple.id).length > 0
    nodes.push({
      id: `couple-${couple.id}`,
      type: 'couple',
      position: pos,
      data: {
        couple,
        onEdit: callbacks.onEditCouple,
        hasChildren: hasKids,
        isCollapsed: coupleCollapsed(couple.id),
        hiddenCount: hasKids ? countCoupleDescendants(couple.id, new Set()) : 0,
        onToggleCollapse: callbacks.onToggleCollapse,
      },
    })

    // Connect each partner to the couple node from whichever side they sit on.
    const p1 = personPos.get(couple.partner1Id)
    const p2 = personPos.get(couple.partner2Id)
    const p1IsLeft = (p1?.x ?? 0) <= (p2?.x ?? 0)

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

  for (const pc of Object.values(parentChildren)) {
    if (!personPos.has(pc.childId)) continue // child is inside a collapsed branch
    if (pc.coupleId && couples[pc.coupleId]) {
      edges.push({
        id: `parentchild-${pc.id}`,
        type: 'parentChild',
        source: `couple-${pc.coupleId}`,
        sourceHandle: 'bottom',
        target: `person-${pc.childId}`,
        targetHandle: 'top',
        data: { type: pc.type },
      } as ParentChildFlowEdge)
    } else if (pc.singleParentId && people[pc.singleParentId]) {
      edges.push({
        id: `parentchild-${pc.id}`,
        type: 'parentChild',
        source: `person-${pc.singleParentId}`,
        sourceHandle: 'bottom',
        target: `person-${pc.childId}`,
        targetHandle: 'top',
        data: { type: pc.type },
      } as ParentChildFlowEdge)
    }
  }

  return { nodes, edges }
}
