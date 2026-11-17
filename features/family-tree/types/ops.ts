import type { Person, Couple, ParentChild } from './index'

/**
 * A single tree mutation, as queued by the client store and applied by the
 * `applyTreeOps` server action. Upserts carry the *full* post-merge entity (the
 * store already computes it optimistically) so the server never has to read the
 * existing row to merge — it just writes what it's told, gated on the version.
 *
 * `set_collapsed` is canvas UI state: last-write-wins and version-exempt (see
 * `applyTreeOps`), so collapsing a node never conflicts with another editor.
 */
export type TreeOp =
  | { t: 'upsert_person'; person: Person }
  | { t: 'delete_person'; id: string }
  | { t: 'upsert_couple'; couple: Couple }
  | { t: 'delete_couple'; id: string }
  | { t: 'upsert_parent_child'; relation: ParentChild }
  | { t: 'delete_parent_child'; id: string }
  | { t: 'clear_tree' }
  | { t: 'set_collapsed'; collapsed: string[] }

/** True for the ops that mutate the graph and therefore bump the tree version. */
export function isVersionedOp(op: TreeOp): boolean {
  return op.t !== 'set_collapsed'
}
