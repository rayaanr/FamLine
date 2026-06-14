import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

/**
 * Access-control statement for Better Auth's admin plugin. Only the global
 * `super_admin` carries elevated (account-management) permissions - per-tree
 * capabilities are NOT modelled here; they live in the tree-role helpers below
 * and are enforced in `lib/tree-access.ts`.
 */
export const statement = {
  ...defaultStatements,
} as const;

export const ac = createAccessControl(statement);

/**
 * Global account roles (the `user.role` column). `super_admin` is the system
 * administrator (manages every user and every tree); everyone else is a plain
 * `user` whose tree access comes entirely from per-tree membership.
 */
export const roles = {
  user: ac.newRole({}),
  super_admin: ac.newRole({ ...adminAc.statements }),
};

export const GLOBAL_ROLES = ["user", "super_admin"] as const;
export type GlobalRole = (typeof GLOBAL_ROLES)[number];

export const GLOBAL_ROLE_LABELS: Record<GlobalRole, string> = {
  user: "User",
  super_admin: "Super Admin",
};

/** System administrator - global visibility over all users and all trees. */
export const isSuperAdmin = (role?: string | null) => role === "super_admin";

// ── Per-tree roles ─────────────────────────────────────────────────────────
/**
 * A user's role on a specific tree. Held via `trees.ownerId` (owner) or a
 * `tree_membership` row. Higher ranks inherit the intent of lower ones.
 */
export const TREE_ROLES = ["member", "editor", "owner"] as const;
export type TreeRole = (typeof TREE_ROLES)[number];

export const TREE_ROLE_RANK: Record<TreeRole, number> = {
  member: 0,
  editor: 1,
  owner: 2,
};

export const TREE_ROLE_LABELS: Record<TreeRole, string> = {
  member: "Member",
  editor: "Editor",
  owner: "Owner",
};

const treeRankOf = (role?: TreeRole | null) =>
  role ? TREE_ROLE_RANK[role] : -1;

/** Has any role on the tree - required to view it. */
export const canViewTree = (role?: TreeRole | null) => treeRankOf(role) >= 0;

/** At least EDITOR - required to edit tree content. */
export const canEditTree = (role?: TreeRole | null) =>
  treeRankOf(role) >= TREE_ROLE_RANK.editor;

/** OWNER - required to rename/delete the tree and manage its members. */
export const canManageTree = (role?: TreeRole | null) =>
  treeRankOf(role) >= TREE_ROLE_RANK.owner;
