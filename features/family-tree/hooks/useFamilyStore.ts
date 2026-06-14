'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { nanoid } from 'nanoid'
import type { FamilyTree, NamedFamilyTree, Person, Couple, ParentChild } from '../types'
import { buildMockFamily } from '../utils/mockData'

interface FamilyStoreState {
  // All family trees, keyed by id. Each tree owns its own people/couples/etc.
  trees: Record<string, NamedFamilyTree>
  // Which tree the canvas and dialogs currently operate on.
  activeTreeId: string

  // ── Tree management ──────────────────────────────────────────────
  createTree: (name?: string) => string
  renameTree: (id: string, name: string) => void
  deleteTree: (id: string) => void
  setActiveTree: (id: string) => void

  // ── Entity actions (operate on the active tree) ──────────────────
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

function makeTree(name: string, data: FamilyTree = emptyTree()): NamedFamilyTree {
  const now = new Date().toISOString()
  return { id: nanoid(), name, createdAt: now, updatedAt: now, ...data }
}

// Pick a default name like "Family Tree 3" that doesn't collide with existing ones.
function nextTreeName(trees: Record<string, NamedFamilyTree>): string {
  const names = new Set(Object.values(trees).map((t) => t.name))
  let n = Object.keys(trees).length + 1
  while (names.has(`Family Tree ${n}`)) n++
  return `Family Tree ${n}`
}

const initialTree = makeTree('My Family')

export const useFamilyStore = create<FamilyStoreState>()(
  persist(
    (set) => {
      // Apply a patch to the active tree, bumping its updatedAt timestamp.
      const patchActive = (patch: (tree: NamedFamilyTree) => Partial<FamilyTree>) =>
        set((s) => {
          const active = s.trees[s.activeTreeId]
          if (!active) return s
          const updated: NamedFamilyTree = {
            ...active,
            ...patch(active),
            updatedAt: new Date().toISOString(),
          }
          return { trees: { ...s.trees, [s.activeTreeId]: updated } }
        })

      return {
        trees: { [initialTree.id]: initialTree },
        activeTreeId: initialTree.id,

        createTree: (name) => {
          const tree = makeTree(name?.trim() || '')
          set((s) => ({
            trees: {
              ...s.trees,
              [tree.id]: { ...tree, name: tree.name || nextTreeName(s.trees) },
            },
            activeTreeId: tree.id,
          }))
          return tree.id
        },

        renameTree: (id, name) =>
          set((s) => {
            const tree = s.trees[id]
            const trimmed = name.trim()
            if (!tree || !trimmed) return s
            return {
              trees: {
                ...s.trees,
                [id]: { ...tree, name: trimmed, updatedAt: new Date().toISOString() },
              },
            }
          }),

        deleteTree: (id) =>
          set((s) => {
            // Never delete the last remaining tree.
            if (!s.trees[id] || Object.keys(s.trees).length <= 1) return s
            const { [id]: _removed, ...trees } = s.trees
            const activeTreeId =
              s.activeTreeId === id ? Object.keys(trees)[0] : s.activeTreeId
            return { trees, activeTreeId }
          }),

        setActiveTree: (id) =>
          set((s) => (s.trees[id] ? { activeTreeId: id } : s)),

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
    },
    {
      name: 'famline-tree',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // v0 stored a single tree flat at the root: { people, couples, parentChildren, collapsed }.
      // Wrap it into the new keyed-trees shape so existing users keep their data.
      migrate: (persisted, version) => {
        if (version === 0 && persisted && typeof persisted === 'object') {
          const old = persisted as Partial<FamilyTree>
          const tree = makeTree('My Family', {
            people: old.people ?? {},
            couples: old.couples ?? {},
            parentChildren: old.parentChildren ?? {},
            collapsed: old.collapsed ?? [],
          })
          return { trees: { [tree.id]: tree }, activeTreeId: tree.id }
        }
        return persisted as FamilyStoreState
      },
    }
  )
)

// ── Convenience selectors ──────────────────────────────────────────
/** The currently active tree (reactive). */
export const useActiveTree = (): NamedFamilyTree =>
  useFamilyStore((s) => s.trees[s.activeTreeId])

/** The active tree outside of React (for event handlers / callbacks). */
export const getActiveTree = (): NamedFamilyTree => {
  const s = useFamilyStore.getState()
  return s.trees[s.activeTreeId]
}
