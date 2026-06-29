import { redirect } from "next/navigation";
import { and, desc, eq, isNotNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { trees, treeMembership } from "@/db/schema";
import { getSession } from "@/lib/auth-server";
import {
  canEditTree,
  canManageTree,
  canViewTree,
  isSuperAdmin,
  type TreeRole,
} from "@/lib/permissions";
import type { NamedFamilyTree } from "@/features/family-tree/types";

type TreeRow = typeof trees.$inferSelect;
type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>;

/** Map a DB row to the client-facing `NamedFamilyTree` (Dates → ISO strings). */
export function toNamedTree(row: TreeRow): NamedFamilyTree {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...row.data,
  };
}

/**
 * The current user's effective role on a tree:
 * super_admin → `owner` (full access); the tree's `ownerId` → `owner`; an
 * explicit membership → its role; otherwise `null` (no access).
 */
function resolveRole(tree: TreeRow, session: Session, membershipRole?: string | null): TreeRole | null {
  if (isSuperAdmin(session.user.role)) return "owner";
  if (tree.ownerId === session.user.id) return "owner";
  return (membershipRole as TreeRole | undefined) ?? null;
}

export async function getEffectiveTreeRole(
  treeId: string,
  session?: Session,
): Promise<TreeRole | null> {
  const s = session ?? (await getSession());
  if (!s) return null;
  const [tree] = await db
    .select({ ownerId: trees.ownerId })
    .from(trees)
    .where(eq(trees.id, treeId))
    .limit(1);
  if (!tree) return null;
  if (isSuperAdmin(s.user.role)) return "owner";
  if (tree.ownerId === s.user.id) return "owner";
  const [m] = await db
    .select({ role: treeMembership.role })
    .from(treeMembership)
    .where(
      and(eq(treeMembership.treeId, treeId), eq(treeMembership.userId, s.user.id)),
    )
    .limit(1);
  return (m?.role as TreeRole | undefined) ?? null;
}

export interface TreeSummary {
  id: string;
  slug: string;
  name: string;
  updatedAt: string;
  peopleCount: number;
  role: TreeRole;
  isOwner: boolean;
}

// Correlated count of indexed people. Identifiers are written qualified on
// purpose: a bare `sql` fragment does NOT auto-qualify interpolated columns, so
// `${trees.id}` would render as a bare `"id"` that binds to people_index inside
// the subquery (making the correlation always false → count 0).
const peopleCountSql = sql<number>`(select count(*) from "people_index" where "people_index"."tree_id" = "trees"."id")`.mapWith(
  Number,
);

/**
 * Trees the current user may view. super_admin sees every tree; everyone else
 * sees trees they own or hold a membership on. Returns lightweight summaries
 * (no JSONB blob) for the gallery.
 */
export async function listAccessibleTrees(): Promise<TreeSummary[]> {
  const session = await getSession();
  if (!session) return [];

  if (isSuperAdmin(session.user.role)) {
    const rows = await db
      .select({
        id: trees.id,
        slug: trees.slug,
        name: trees.name,
        updatedAt: trees.updatedAt,
        ownerId: trees.ownerId,
        peopleCount: peopleCountSql,
      })
      .from(trees)
      .orderBy(desc(trees.updatedAt));
    return rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      updatedAt: r.updatedAt.toISOString(),
      peopleCount: r.peopleCount,
      role: "owner",
      isOwner: r.ownerId === session.user.id,
    }));
  }

  const rows = await db
    .select({
      id: trees.id,
      slug: trees.slug,
      name: trees.name,
      updatedAt: trees.updatedAt,
      ownerId: trees.ownerId,
      membershipRole: treeMembership.role,
      peopleCount: peopleCountSql,
    })
    .from(trees)
    .leftJoin(
      treeMembership,
      and(
        eq(treeMembership.treeId, trees.id),
        eq(treeMembership.userId, session.user.id),
      ),
    )
    .where(
      or(eq(trees.ownerId, session.user.id), isNotNull(treeMembership.id)),
    )
    .orderBy(desc(trees.updatedAt));

  return rows.map((r) => {
    const isOwner = r.ownerId === session.user.id;
    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      updatedAt: r.updatedAt.toISOString(),
      peopleCount: r.peopleCount,
      role: isOwner ? "owner" : ((r.membershipRole as TreeRole) ?? "member"),
      isOwner,
    };
  });
}

// ── Route guards ─────────────────────────────────────────────────────────────
async function loadTreeOrRedirect(idOrSlug: string) {
  const session = await getSession();
  if (!session) redirect("/login");
  // The URL param may be either the canonical id or the human-readable slug.
  const [tree] = await db
    .select()
    .from(trees)
    .where(or(eq(trees.id, idOrSlug), eq(trees.slug, idOrSlug)))
    .limit(1);
  if (!tree) redirect("/tree");

  let membershipRole: string | null = null;
  if (!isSuperAdmin(session.user.role) && tree.ownerId !== session.user.id) {
    const [m] = await db
      .select({ role: treeMembership.role })
      .from(treeMembership)
      .where(
        and(
          eq(treeMembership.treeId, tree.id),
          eq(treeMembership.userId, session.user.id),
        ),
      )
      .limit(1);
    membershipRole = m?.role ?? null;
  }
  const role = resolveRole(tree, session, membershipRole);
  return { tree, role, session };
}

/** Gate on view access (any tree role). Returns the full tree row + role. */
export async function requireTreeView(treeId: string) {
  const { tree, role, session } = await loadTreeOrRedirect(treeId);
  if (!canViewTree(role)) redirect("/tree");
  return { tree, role: role as TreeRole, session };
}

/** Gate on edit access (editor+). */
export async function requireTreeEdit(treeId: string) {
  const { tree, role, session } = await loadTreeOrRedirect(treeId);
  if (!canEditTree(role)) redirect("/tree");
  return { tree, role: role as TreeRole, session };
}

/** Gate on ownership (rename/delete/manage members). */
export async function requireTreeOwner(treeId: string) {
  const { tree, role, session } = await loadTreeOrRedirect(treeId);
  if (!canManageTree(role)) redirect("/tree");
  return { tree, role: role as TreeRole, session };
}
