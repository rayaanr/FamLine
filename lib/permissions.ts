import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

/**
 * Access-control statement shared by the server (`lib/auth.ts`) and the client
 * (`lib/auth-client.ts`). `defaultStatements` carries the admin plugin's
 * built-in `user`/`session` permissions so `super_admin` can manage accounts.
 */
export const statement = {
  ...defaultStatements,
  tree: ["view", "edit", "create", "delete"],
} as const;

export const ac = createAccessControl(statement);

/**
 * Global capability tiers. Higher tiers inherit the intent of lower ones
 * (enforced via {@link ROLE_RANK} in route guards, not by permission nesting).
 */
export const roles = {
  user: ac.newRole({}),
  member: ac.newRole({ tree: ["view"] }),
  editor: ac.newRole({ tree: ["view", "edit"] }),
  owner: ac.newRole({ tree: ["view", "edit", "create", "delete"] }),
  super_admin: ac.newRole({
    ...adminAc.statements,
    tree: ["view", "edit", "create", "delete"],
  }),
};

export const ROLE_RANK = {
  user: 0,
  member: 1,
  editor: 2,
  owner: 3,
  super_admin: 4,
} as const;

export type AppRole = keyof typeof ROLE_RANK;

export const ROLE_LABELS: Record<AppRole, string> = {
  user: "User",
  member: "Member",
  editor: "Editor",
  owner: "Owner",
  super_admin: "Super Admin",
};

export const APP_ROLES = Object.keys(ROLE_RANK) as AppRole[];

const rankOf = (role?: string | null) =>
  ROLE_RANK[(role ?? "user") as AppRole] ?? 0;

/** At least MEMBER — required to view a tree. */
export const canViewTree = (role?: string | null) =>
  rankOf(role) >= ROLE_RANK.member;

/** At least EDITOR — required to edit tree content. */
export const canEditTree = (role?: string | null) =>
  rankOf(role) >= ROLE_RANK.editor;

/** At least OWNER — required to create/delete trees. */
export const canManageTrees = (role?: string | null) =>
  rankOf(role) >= ROLE_RANK.owner;

/** System administrator. */
export const isSuperAdmin = (role?: string | null) =>
  rankOf(role) >= ROLE_RANK.super_admin;
