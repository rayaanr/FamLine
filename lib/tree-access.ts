import { redirect } from "next/navigation";
import { and, desc, eq, isNotNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  trees,
  treeMembership,
  treePerson,
  treeCouple,
  treeParentChild,
} from "@/db/schema";
import { getSession } from "@/lib/auth-server";
import {
  canEditTree,
  canManageTree,
  canViewTree,
  isSuperAdmin,
  type TreeRole,
} from "@/lib/permissions";
import type {
  NamedFamilyTree,
  Person,
  Couple,
  ParentChild,
  Gender,
  CoupleStatus,
  ParentChildType,
} from "@/features/family-tree/types";

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
  version: trees.version,
  collapsed: trees.collapsed,
  settings: trees.settings,
  createdAt: trees.createdAt,
  updatedAt: trees.updatedAt,
} as const;

type TreeProjected = {
  id: string;
  slug: string;
  name: string;
  ownerId: string;
  version: number;
  collapsed: string[];
  settings: TreeRow["settings"];
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Assemble the client-facing `NamedFamilyTree` from a tree's metadata row plus
 * its relational people / couples / parent-child rows. Replaces the old
 * `toNamedTree` (which spread a single JSONB blob). Loads the three entity
 * tables in parallel and folds them into the `Record<id, T>` maps the canvas
 * and layout expect — client types are unchanged.
 */
export async function getTreeGraph(meta: TreeProjected): Promise<NamedFamilyTree> {
  const [people, couples, parentChildren] = await Promise.all([
    db
      .select()
      .from(treePerson)
      .where(eq(treePerson.treeId, meta.id)),
    db
      .select()
      .from(treeCouple)
      .where(eq(treeCouple.treeId, meta.id)),
    db
      .select()
      .from(treeParentChild)
      .where(eq(treeParentChild.treeId, meta.id)),
  ]);

  const peopleMap: Record<string, Person> = {};
  for (const p of people) {
    peopleMap[p.id] = {
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      birthDate: p.birthDate ?? undefined,
      birthPlace: p.birthPlace ?? undefined,
      deathDate: p.deathDate ?? undefined,
      isDeceased: p.isDeceased,
      gender: p.gender as Gender,
      notes: p.notes ?? undefined,
      isPlaceholder: p.isPlaceholder || undefined,
    };
  }

  const couplesMap: Record<string, Couple> = {};
  for (const c of couples) {
    couplesMap[c.id] = {
      id: c.id,
      partner1Id: c.partner1Id,
      partner2Id: c.partner2Id,
      status: c.status as CoupleStatus,
      startDate: c.startDate ?? undefined,
      endDate: c.endDate ?? undefined,
      marriagePlace: c.marriagePlace ?? undefined,
    };
  }

  const pcMap: Record<string, ParentChild> = {};
  for (const pc of parentChildren) {
    pcMap[pc.id] = {
      id: pc.id,
      childId: pc.childId,
      coupleId: pc.coupleId ?? undefined,
      singleParentId: pc.singleParentId ?? undefined,
      type: pc.type as ParentChildType,
    };
  }

  return {
    id: meta.id,
    name: meta.name,
    version: meta.version,
    createdAt: meta.createdAt.toISOString(),
    updatedAt: meta.updatedAt.toISOString(),
    people: peopleMap,
    couples: couplesMap,
    parentChildren: pcMap,
    collapsed: meta.collapsed ?? [],
  };
}

/** Fetch a tree's metadata + assembled graph by canonical id (no access check). */
export async function getTreeGraphById(
  treeId: string,
): Promise<NamedFamilyTree | null> {
  const [meta] = await db
    .select(treeProjection)
    .from(trees)
    .where(eq(trees.id, treeId))
    .limit(1);
  if (!meta) return null;
  return getTreeGraph(meta);
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
    treeId: treePerson.treeId,
    count: sql<number>`count(*)`.mapWith(Number).as("count"),
  })
  .from(treePerson)
  .groupBy(treePerson.treeId)
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
// Always loads the lightweight metadata projection (never the legacy `data`
// blob). Callers that need the full graph resolve access here, then assemble it
// from the relational tables via `getTreeGraph`.
async function loadTreeOrRedirect(
  idOrSlug: string,
): Promise<{ tree: TreeProjected; role: TreeRole | null; session: Session }> {
  const session = await getSession();
  if (!session) redirect("/login");
  // The URL param may be either the canonical id or the human-readable slug.
  const whereClause = or(eq(trees.id, idOrSlug), eq(trees.slug, idOrSlug));
  const [tree] = await db
    .select(treeProjection)
    .from(trees)
    .where(whereClause)
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

/** Gate on view access (any tree role). Returns the tree metadata (no `data`) + role. */
export async function requireTreeView(treeId: string) {
  const { tree, role, session } = await loadTreeOrRedirect(treeId);
  if (!canViewTree(role)) redirect("/tree");
  return { tree, role: role as TreeRole, session };
}

/**
 * Gate on view access and assemble the full graph from the relational tables.
 * Only the tree page's Server Component needs this — everything else should
 * use `requireTreeView`.
 */
export async function requireTreeViewWithGraph(treeId: string) {
  const { tree, role, session } = await loadTreeOrRedirect(treeId);
  if (!canViewTree(role)) redirect("/tree");
  const graph = await getTreeGraph(tree);
  return { tree, graph, role: role as TreeRole, session };
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
