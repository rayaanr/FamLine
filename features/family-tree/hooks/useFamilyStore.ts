'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { FamilyTree, Person, Couple, ParentChild } from '../types'
import { buildMockFamily } from '../utils/mockData'

interface FamilyStoreState extends FamilyTree {
  // Node ids (`couple-<id>` / `person-<id>`) whose descendants are collapsed.
  // View state, but persisted so the view survives reloads.
  collapsed: string[]
  addPerson: (person: Person) => void
  updatePerson: (id: string, updates: Partial<Person>) => void
  removePerson: (id: string) => void
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

export const useFamilyStore = create<FamilyStoreState>()(
  persist(
    (set) => ({
      people: {},
      couples: {},
      parentChildren: {},
      collapsed: [],

      addPerson: (person) =>
        set((s) => ({ people: { ...s.people, [person.id]: person } })),

      updatePerson: (id, updates) =>
        set((s) => ({
          people: { ...s.people, [id]: { ...s.people[id], ...updates } },
        })),

      removePerson: (id) =>
        set((s) => {
          const { [id]: _p, ...people } = s.people
          const couples = Object.fromEntries(
            Object.entries(s.couples).filter(
              ([, c]) => c.partner1Id !== id && c.partner2Id !== id
            )
          )
          const removedCoupleIds = new Set(
            Object.keys(s.couples).filter(
              (cid) =>
                s.couples[cid].partner1Id === id || s.couples[cid].partner2Id === id
            )
          )
          const parentChildren = Object.fromEntries(
            Object.entries(s.parentChildren).filter(
              ([, pc]) =>
                pc.childId !== id &&
                pc.singleParentId !== id &&
                !(pc.coupleId && removedCoupleIds.has(pc.coupleId))
            )
          )
          return { people, couples, parentChildren }
        }),

      addCouple: (couple) =>
        set((s) => ({ couples: { ...s.couples, [couple.id]: couple } })),

      updateCouple: (id, updates) =>
        set((s) => ({
          couples: { ...s.couples, [id]: { ...s.couples[id], ...updates } },
        })),

      removeCouple: (id) =>
        set((s) => {
          const { [id]: _c, ...couples } = s.couples
          const parentChildren = Object.fromEntries(
            Object.entries(s.parentChildren).filter(([, pc]) => pc.coupleId !== id)
          )
          return { couples, parentChildren }
        }),

      addParentChild: (relation) =>
        set((s) => ({
          parentChildren: { ...s.parentChildren, [relation.id]: relation },
        })),

      removeParentChild: (id) =>
        set((s) => {
          const { [id]: _r, ...parentChildren } = s.parentChildren
          return { parentChildren }
        }),

      toggleCollapse: (nodeId) =>
        set((s) => ({
          collapsed: s.collapsed.includes(nodeId)
            ? s.collapsed.filter((id) => id !== nodeId)
            : [...s.collapsed, nodeId],
        })),

      expandAll: () => set({ collapsed: [] }),

      clearTree: () =>
        set({ people: {}, couples: {}, parentChildren: {}, collapsed: [] }),

      loadMockData: () => set({ ...buildMockFamily(), collapsed: [] }),
    }),
    {
      name: 'famline-tree',
      storage: createJSONStorage(() => localStorage),
    }
  )
)
