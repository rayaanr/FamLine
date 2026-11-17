'use client'

import { create } from 'zustand'
import { toast } from 'sonner'
import type { FamilyTree, NamedFamilyTree, Person, Couple, ParentChild } from '../types'
import type { TreeOp } from '../types/ops'
import { buildMockFamily } from '../utils/mockData'
import { applyTreeOps } from '../server/actions'

interface FamilyStoreState {
  // The trees currently loaded in memory (normally just the active one, hydrated
  // from the database via `loadTree`).
  trees: Record<string, NamedFamilyTree>
  // Which tree the canvas and dialogs currently operate on.
  activeTreeId: string

  // ── Loading ──────────────────────────────────────────────────────
  // Hydrate one DB-backed tree into the store and make it active. Does NOT
  // enqueue any ops (it's loading, not mutating).
  loadTree: (tree: NamedFamilyTree) => void

  // ── Entity actions (operate on the active tree; each enqueues ops) ─
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

// ── Op-log autosave ───────────────────────────────────────────────────────────
// Every mutation enqueues one or more `TreeOp`s per tree. A debounced flush ships
// the whole queue to `applyTreeOps` with the tree's last-known version. The queue
// preserves mutation order (so add-person-then-add-couple works), and flushes are
// serialized per tree so `baseVersion` stays monotonic.

const FLUSH_DEBOUNCE_MS = 800
const RETRY_MS = 5000

const opQueues = new Map<string, TreeOp[]>()
const flushTimers = new Map<string, ReturnType<typeof setTimeout>>()
const retryTimers = new Map<string, ReturnType<typeof setTimeout>>()
const inFlight = new Set<string>()

function enqueue(treeId: string, ops: TreeOp[]): void {
  if (ops.length === 0) return
  const q = opQueues.get(treeId) ?? []
  q.push(...ops)
  opQueues.set(treeId, q)
  scheduleFlush(treeId)
}

function scheduleFlush(treeId: string): void {
  const existing = flushTimers.get(treeId)
  if (existing) clearTimeout(existing)
  flushTimers.set(treeId, setTimeout(() => void fireFlush(treeId), FLUSH_DEBOUNCE_MS))
}

function scheduleRetry(treeId: string): void {
  const existing = retryTimers.get(treeId)
  if (existing) clearTimeout(existing)
  retryTimers.set(treeId, setTimeout(() => void fireFlush(treeId), RETRY_MS))
}

/** Prepend failed ops ahead of anything queued while they were in flight. */
function requeue(treeId: string, ops: TreeOp[]): void {
  const q = opQueues.get(treeId) ?? []
  opQueues.set(treeId, [...ops, ...q])
}

function setVersion(treeId: string, version: number): void {
  useFamilyStore.setState((s) => {
    const t = s.trees[treeId]
    if (!t || t.version === version) return s
    return { trees: { ...s.trees, [treeId]: { ...t, version } } }
  })
}

async function fireFlush(treeId: string): Promise<void> {
  const timer = flushTimers.get(treeId)
  if (timer) {
    clearTimeout(timer)
    flushTimers.delete(treeId)
  }
  // Serialize: if a flush is already running for this tree, the running flush's
  // `finally` will reschedule once the queue is free.
  if (inFlight.has(treeId)) return

  const ops = opQueues.get(treeId)
  if (!ops || ops.length === 0) return

  const active = useFamilyStore.getState().trees[treeId]
  if (!active) return

  // Splice the queue and take the baseVersion together.
  opQueues.set(treeId, [])
  inFlight.add(treeId)
  const baseVersion = active.version

  try {
    const res = await applyTreeOps(treeId, ops, baseVersion)
    if ('conflict' in res) {
      // Someone else saved first. Drop our in-flight + queued ops and reload the
      // authoritative graph — the user sees the latest state.
      opQueues.set(treeId, [])
      toast.error('This tree was updated by someone else — reloaded the latest version')
      useFamilyStore.getState().loadTree(res.graph)
    } else if ('error' in res) {
      requeue(treeId, ops)
      toast.error("Changes couldn't be saved — will retry")
      scheduleRetry(treeId)
    } else {
      setVersion(treeId, res.version)
    }
  } catch (err) {
    console.error('Failed to save tree changes', err)
    requeue(treeId, ops)
    toast.error("Changes couldn't be saved — will retry")
    scheduleRetry(treeId)
  } finally {
    inFlight.delete(treeId)
    if ((opQueues.get(treeId)?.length ?? 0) > 0) scheduleFlush(treeId)
  }
}

/**
 * Immediately fire every pending flush, skipping the debounce window. Call
 * before anything that would otherwise silently drop queued ops: unmounting the
 * tree canvas, or the page actually going away. (A server-action POST fired
 * during `pagehide` may still be cancelled by the browser — unchanged risk.)
 */
export function flushPendingSaves(): void {
  for (const treeId of Array.from(opQueues.keys())) {
    void fireFlush(treeId)
  }
}

if (typeof window !== 'undefined') {
  // Covers an actual tab close/reload; SPA-internal navigation away from the
  // tree canvas is handled by TreeView's unmount flush instead, since it
  // never fires pagehide.
  window.addEventListener('pagehide', flushPendingSaves)
}

export const useFamilyStore = create<FamilyStoreState>()((set) => {
  // Apply a patch to the active tree (optimistic local state), bump its
  // updatedAt, and enqueue the ops that mirror the mutation server-side. `makeOps`
  // receives the tree before and after the patch so it can read merged entities.
  const patchActive = (
    patch: (tree: NamedFamilyTree) => Partial<FamilyTree>,
    makeOps?: (before: NamedFamilyTree, after: NamedFamilyTree) => TreeOp[],
  ) =>
    set((s) => {
      const active = s.trees[s.activeTreeId]
      if (!active) return s
      const patchResult = patch(active)
      const updated: NamedFamilyTree = {
        ...active,
        ...patchResult,
        updatedAt: new Date().toISOString(),
      }
      if (makeOps) enqueue(s.activeTreeId, makeOps(active, updated))
      return { trees: { ...s.trees, [s.activeTreeId]: updated } }
    })

  return {
    trees: {},
    activeTreeId: '',

    loadTree: (tree) => {
      const t = flushTimers.get(tree.id)
      if (t) clearTimeout(t)
      const r = retryTimers.get(tree.id)
      if (r) clearTimeout(r)
      opQueues.set(tree.id, [])
      set({ trees: { [tree.id]: tree }, activeTreeId: tree.id })
    },

    addPerson: (person) =>
      patchActive(
        (t) => ({ people: { ...t.people, [person.id]: person } }),
        () => [{ t: 'upsert_person', person }],
      ),

    updatePerson: (id, updates) =>
      patchActive(
        (t) => ({
          people: { ...t.people, [id]: { ...t.people[id], ...updates } },
        }),
        (_before, after) =>
          after.people[id] ? [{ t: 'upsert_person', person: after.people[id] }] : [],
      ),

    removePerson: (id) =>
      patchActive(
        (t) => {
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
        },
        // The server cascades couples/parent-child from the person delete via FK,
        // so a single delete_person op mirrors the whole local cascade.
        () => [{ t: 'delete_person', id }],
      ),

    removePeople: (ids) =>
      patchActive(
        (t) => {
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
        },
        (_before, after) => [
          ...ids.map((id): TreeOp => ({ t: 'delete_person', id })),
          { t: 'set_collapsed', collapsed: after.collapsed },
        ],
      ),

    convertToPlaceholder: (id) =>
      patchActive(
        (t) => {
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
        },
        (_before, after) =>
          after.people[id] ? [{ t: 'upsert_person', person: after.people[id] }] : [],
      ),

    addCouple: (couple) =>
      patchActive(
        (t) => ({ couples: { ...t.couples, [couple.id]: couple } }),
        () => [{ t: 'upsert_couple', couple }],
      ),

    updateCouple: (id, updates) =>
      patchActive(
        (t) => ({
          couples: { ...t.couples, [id]: { ...t.couples[id], ...updates } },
        }),
        (_before, after) =>
          after.couples[id] ? [{ t: 'upsert_couple', couple: after.couples[id] }] : [],
      ),

    removeCouple: (id) =>
      patchActive(
        (t) => {
          const { [id]: _c, ...couples } = t.couples
          const parentChildren = Object.fromEntries(
            Object.entries(t.parentChildren).filter(([, pc]) => pc.coupleId !== id)
          )
          return { couples, parentChildren }
        },
        // Server cascades the couple's parent-child links via FK.
        () => [{ t: 'delete_couple', id }],
      ),

    addParentChild: (relation) =>
      patchActive(
        (t) => ({
          parentChildren: { ...t.parentChildren, [relation.id]: relation },
        }),
        () => [{ t: 'upsert_parent_child', relation }],
      ),

    removeParentChild: (id) =>
      patchActive(
        (t) => {
          const { [id]: _r, ...parentChildren } = t.parentChildren
          return { parentChildren }
        },
        () => [{ t: 'delete_parent_child', id }],
      ),

    toggleCollapse: (nodeId) =>
      patchActive(
        (t) => ({
          collapsed: t.collapsed.includes(nodeId)
            ? t.collapsed.filter((id) => id !== nodeId)
            : [...t.collapsed, nodeId],
        }),
        (_before, after) => [{ t: 'set_collapsed', collapsed: after.collapsed }],
      ),

    expandAll: () =>
      patchActive(
        () => ({ collapsed: [] }),
        () => [{ t: 'set_collapsed', collapsed: [] }],
      ),

    clearTree: () =>
      patchActive(
        () => emptyTree(),
        () => [{ t: 'clear_tree' }, { t: 'set_collapsed', collapsed: [] }],
      ),

    loadMockData: () =>
      patchActive(
        () => ({ ...buildMockFamily(), collapsed: [] }),
        (_before, after) => [
          { t: 'clear_tree' },
          ...Object.values(after.people).map((person): TreeOp => ({ t: 'upsert_person', person })),
          ...Object.values(after.couples).map((couple): TreeOp => ({ t: 'upsert_couple', couple })),
          ...Object.values(after.parentChildren).map(
            (relation): TreeOp => ({ t: 'upsert_parent_child', relation }),
          ),
          { t: 'set_collapsed', collapsed: [] },
        ],
      ),
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
