'use client'

import { create } from 'zustand'
import type { FamilyTree, NamedFamilyTree, Person, Couple, ParentChild } from '../types'
import { buildMockFamily } from '../utils/mockData'
import { saveTreeData } from '../server/actions'

interface FamilyStoreState {
  // The trees currently loaded in memory (normally just the active one, hydrated
  // from the database via `loadTree`).
  trees: Record<string, NamedFamilyTree>
  // Which tree the canvas and dialogs currently operate on.
  activeTreeId: string

  // ── Loading ──────────────────────────────────────────────────────
  // Hydrate one DB-backed tree into the store and make it active. Does NOT
  // trigger a save (it's loading, not mutating).
  loadTree: (tree: NamedFamilyTree) => void

  // ── Entity actions (operate on the active tree; each autosaves) ───
  addPerson: (person: Person) => void
  updatePerson: (id: string, updates: Partial<Person>) => void
  removePerson: (id: string) => void
  // Remove several people at once (and any couples / parent-child links that
  // depended on them). Used to delete a whole branch.
  removePeople: (ids: string[]) => void
  // Wipe a person's identity but keep their node + relationships, turning them
  // into an "Unknown" placeholder so the surrounding tree stays connected.
  convertToPlaceholder: (id: string) => void
  addCouple: (couple: Couple) => void
  updateCouple: (id: string, updates: Partial<Couple>) => void
  removeCouple: (id: string) => void
  addParentChild: (relation: ParentChild) => void
  removeParentChild: (id: string) => void
  toggleCollapse: (nodeId: string) => void
  expandAll: () => void
  clearTree: () => void
  loadMockData: () => void
}

const emptyTree = (): FamilyTree => ({
  people: {},
  couples: {},
  parentChildren: {},
  collapsed: [],
})

/** Strip the row metadata, leaving just the persistable graph. */
const graphOf = (tree: NamedFamilyTree): FamilyTree => ({
  people: tree.people,
  couples: tree.couples,
  parentChildren: tree.parentChildren,
  collapsed: tree.collapsed,
})

// Debounced autosave to the database, keyed per tree so editing tree B within
// the debounce window can't cancel tree A's still-pending save (a single
// shared timer used to do exactly that, silently dropping A's last change).
const SAVE_DEBOUNCE_MS = 800

interface PendingSave {
  timer: ReturnType<typeof setTimeout>
  data: FamilyTree
  // Whether this batch of changes touched `people` and therefore needs
  // `people_index` rebuilt. Sticky across coalesced schedules for the same
  // tree: once dirty, stays dirty until the save actually fires.
  indexDirty: boolean
}

const pendingSaves = new Map<string, PendingSave>()

function fireSave(treeId: string) {
  const pending = pendingSaves.get(treeId)
  if (!pending) return
  pendingSaves.delete(treeId)
  void saveTreeData(treeId, pending.data, { skipIndex: !pending.indexDirty }).catch((err) => {
    console.error('Failed to autosave tree', err)
  })
}

function scheduleSave(treeId: string, data: FamilyTree, indexDirty: boolean) {
  const existing = pendingSaves.get(treeId)
  if (existing) clearTimeout(existing.timer)
  const timer = setTimeout(() => fireSave(treeId), SAVE_DEBOUNCE_MS)
  pendingSaves.set(treeId, {
    timer,
    data,
    indexDirty: indexDirty || (existing?.indexDirty ?? false),
  })
}

/**
 * Immediately fire every pending autosave, skipping the debounce window.
 * Call before anything that would otherwise silently drop a pending save:
 * unmounting the tree canvas, or the page actually going away.
 */
export function flushPendingSaves(): void {
  const entries = Array.from(pendingSaves.entries())
  pendingSaves.clear()
  for (const [treeId, pending] of entries) {
    clearTimeout(pending.timer)
    void saveTreeData(treeId, pending.data, { skipIndex: !pending.indexDirty }).catch((err) => {
      console.error('Failed to autosave tree', err)
    })
  }
}

if (typeof window !== 'undefined') {
  // Covers an actual tab close/reload; SPA-internal navigation away from the
  // tree canvas is handled by TreeView's unmount flush instead, since it
  // never fires pagehide.
  window.addEventListener('pagehide', flushPendingSaves)
}

export const useFamilyStore = create<FamilyStoreState>()((set) => {
  // Apply a patch to the active tree, bump its updatedAt, and queue a save.
  const patchActive = (patch: (tree: NamedFamilyTree) => Partial<FamilyTree>) =>
    set((s) => {
      const active = s.trees[s.activeTreeId]
      if (!active) return s
      const patchResult = patch(active)
      const updated: NamedFamilyTree = {
        ...active,
        ...patchResult,
        updatedAt: new Date().toISOString(),
      }
      scheduleSave(s.activeTreeId, graphOf(updated), 'people' in patchResult)
      return { trees: { ...s.trees, [s.activeTreeId]: updated } }
    })

  return {
    trees: {},
    activeTreeId: '',

    loadTree: (tree) =>
      set({ trees: { [tree.id]: tree }, activeTreeId: tree.id }),

    addPerson: (person) =>
      patchActive((t) => ({ people: { ...t.people, [person.id]: person } })),

    updatePerson: (id, updates) =>
      patchActive((t) => ({
        people: { ...t.people, [id]: { ...t.people[id], ...updates } },
      })),

    removePerson: (id) =>
      patchActive((t) => {
        const { [id]: _p, ...people } = t.people
        const removedCoupleIds = new Set(
          Object.keys(t.couples).filter(
            (cid) =>
              t.couples[cid].partner1Id === id || t.couples[cid].partner2Id === id
          )
        )
        const couples = Object.fromEntries(
          Object.entries(t.couples).filter(
            ([, c]) => c.partner1Id !== id && c.partner2Id !== id
          )
        )
        const parentChildren = Object.fromEntries(
          Object.entries(t.parentChildren).filter(
            ([, pc]) =>
              pc.childId !== id &&
              pc.singleParentId !== id &&
              !(pc.coupleId && removedCoupleIds.has(pc.coupleId))
          )
        )
        return { people, couples, parentChildren }
      }),

    removePeople: (ids) =>
      patchActive((t) => {
        const idSet = new Set(ids)
        const people = Object.fromEntries(
          Object.entries(t.people).filter(([pid]) => !idSet.has(pid))
        )
        const removedCoupleIds = new Set(
          Object.keys(t.couples).filter(
            (cid) =>
              idSet.has(t.couples[cid].partner1Id) || idSet.has(t.couples[cid].partner2Id)
          )
        )
        const couples = Object.fromEntries(
          Object.entries(t.couples).filter(([cid]) => !removedCoupleIds.has(cid))
        )
        const parentChildren = Object.fromEntries(
          Object.entries(t.parentChildren).filter(
            ([, pc]) =>
              !idSet.has(pc.childId) &&
              !(pc.singleParentId && idSet.has(pc.singleParentId)) &&
              !(pc.coupleId && removedCoupleIds.has(pc.coupleId))
          )
        )
        const collapsed = t.collapsed.filter((key) => {
          if (key.startsWith('person-')) return !idSet.has(key.slice('person-'.length))
          if (key.startsWith('couple-')) return !removedCoupleIds.has(key.slice('couple-'.length))
          return true
        })
        return { people, couples, parentChildren, collapsed }
      }),

    convertToPlaceholder: (id) =>
      patchActive((t) => {
        const p = t.people[id]
        if (!p) return {}
        return {
          people: {
            ...t.people,
            [id]: {
              ...p,
              firstName: '',
              lastName: '',
              gender: 'unknown',
              isDeceased: false,
              birthDate: undefined,
              deathDate: undefined,
              notes: undefined,
              isPlaceholder: true,
            },
          },
        }
      }),

    addCouple: (couple) =>
      patchActive((t) => ({ couples: { ...t.couples, [couple.id]: couple } })),

    updateCouple: (id, updates) =>
      patchActive((t) => ({
        couples: { ...t.couples, [id]: { ...t.couples[id], ...updates } },
      })),

    removeCouple: (id) =>
      patchActive((t) => {
        const { [id]: _c, ...couples } = t.couples
        const parentChildren = Object.fromEntries(
          Object.entries(t.parentChildren).filter(([, pc]) => pc.coupleId !== id)
        )
        return { couples, parentChildren }
      }),

    addParentChild: (relation) =>
      patchActive((t) => ({
        parentChildren: { ...t.parentChildren, [relation.id]: relation },
      })),

    removeParentChild: (id) =>
      patchActive((t) => {
        const { [id]: _r, ...parentChildren } = t.parentChildren
        return { parentChildren }
      }),

    toggleCollapse: (nodeId) =>
      patchActive((t) => ({
        collapsed: t.collapsed.includes(nodeId)
          ? t.collapsed.filter((id) => id !== nodeId)
          : [...t.collapsed, nodeId],
      })),

    expandAll: () => patchActive(() => ({ collapsed: [] })),

    clearTree: () => patchActive(() => emptyTree()),

    loadMockData: () => patchActive(() => ({ ...buildMockFamily(), collapsed: [] })),
  }
})

// ── Convenience selectors ──────────────────────────────────────────
/** The currently active tree (reactive). */
export const useActiveTree = (): NamedFamilyTree =>
  useFamilyStore((s) => s.trees[s.activeTreeId])

/** The active tree outside of React (for event handlers / callbacks). */
export const getActiveTree = (): NamedFamilyTree => {
  const s = useFamilyStore.getState()
  return s.trees[s.activeTreeId]
}
