import { redirect } from "next/navigation";
import { and, desc, eq, isNotNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { trees, treeMembership, peopleIndex } from "@/db/schema";
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

// Columns needed for authorization/display, deliberately excluding the
// (potentially large) `data` JSONB blob. Guards that don't need the graph
// itself (every one except the tree page render) use this projection so the
// hot, high-frequency autosave path never round-trips the blob just to check
// permissions.
const treeProjection = {
  id: trees.id,
  slug: trees.slug,
  name: trees.name,
  ownerId: trees.ownerId,
  settings: trees.settings,
  createdAt: trees.createdAt,
  updatedAt: trees.updatedAt,
} as const;

type TreeProjected = {
  id: string;
  slug: string;
  name: string;
  ownerId: string;
  settings: TreeRow["settings"];
  createdAt: Date;
  updatedAt: Date;
};

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
function resolveRole(
  tree: { ownerId: string },
  session: Session,
  membershipRole?: string | null,
): TreeRole | null {
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

// Per-tree people count, grouped once as a derived table instead of a
// correlated subquery evaluated per tree row (the old version re-scanned
// people_index once per tree — worst case every tree in the system for a
// super_admin).
const peopleCounts = db
  .select({
    treeId: peopleIndex.treeId,
    count: sql<number>`count(*)`.mapWith(Number).as("count"),
  })
  .from(peopleIndex)
  .groupBy(peopleIndex.treeId)
  .as("people_counts");

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
        peopleCount: sql<number>`coalesce(${peopleCounts.count}, 0)`.mapWith(Number),
      })
      .from(trees)
      .leftJoin(peopleCounts, eq(peopleCounts.treeId, trees.id))
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
      peopleCount: sql<number>`coalesce(${peopleCounts.count}, 0)`.mapWith(Number),
    })
    .from(trees)
    .leftJoin(
      treeMembership,
      and(
        eq(treeMembership.treeId, trees.id),
        eq(treeMembership.userId, session.user.id),
      ),
    )
    .leftJoin(peopleCounts, eq(peopleCounts.treeId, trees.id))
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
// Overloaded so the `data` JSONB blob is only in scope (and only fetched) when
// a caller explicitly asks for it via `withData: true` — every guard except
// the tree page's render goes through the lightweight projection.
async function loadTreeOrRedirect(
  idOrSlug: string,
  withData: true,
): Promise<{ tree: TreeRow; role: TreeRole | null; session: Session }>;
async function loadTreeOrRedirect(
  idOrSlug: string,
  withData?: false,
): Promise<{ tree: TreeProjected; role: TreeRole | null; session: Session }>;
async function loadTreeOrRedirect(idOrSlug: string, withData = false) {
  const session = await getSession();
  if (!session) redirect("/login");
  // The URL param may be either the canonical id or the human-readable slug.
  const whereClause = or(eq(trees.id, idOrSlug), eq(trees.slug, idOrSlug));
  const [tree] = withData
    ? await db.select().from(trees).where(whereClause).limit(1)
    : await db.select(treeProjection).from(trees).where(whereClause).limit(1);
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

/** Gate on view access (any tree role). Returns the tree metadata (no `data`) + role. */
export async function requireTreeView(treeId: string) {
  const { tree, role, session } = await loadTreeOrRedirect(treeId);
  if (!canViewTree(role)) redirect("/tree");
  return { tree, role: role as TreeRole, session };
}

/**
 * Gate on view access, fetching the full row (including the `data` graph).
 * Only the tree page's Server Component needs this — everything else should
 * use `requireTreeView`.
 */
export async function requireTreeViewWithData(treeId: string) {
  const { tree, role, session } = await loadTreeOrRedirect(treeId, true);
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
