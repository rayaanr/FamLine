"use server";

import { nanoid } from "nanoid";
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq, isNull, isNotNull, gt, desc, or, like, max, inArray, sql } from "drizzle-orm";
import { db, isNeonHttp } from "@/db";
import {
  trees,
  treeMembership,
  treePerson,
  treeCouple,
  treeParentChild,
  treeRevision,
  mediaAsset,
  user,
  treeInvitation,
} from "@/db/schema";
import { requireAuth } from "@/lib/auth-server";
import { slugify } from "@/features/family-tree/utils/slug";
import {
  requireTreeEdit,
  requireTreeOwner,
  requireTreeView,
  getTreeGraphById,
} from "@/lib/tree-access";
import { TREE_ROLES, isSuperAdmin, type TreeRole } from "@/lib/permissions";
import type {
  FamilyTree,
  NamedFamilyTree,
} from "@/features/family-tree/types";
import { buildMockFamily } from "@/features/family-tree/utils/mockData";
import { deleteByPrefix, deleteObject } from "@/lib/r2";
import { sendInviteEmail } from "@/lib/email";
import {
  parseOps,
  planStatements,
  mediaCleanupStmts,
  revisionStmt,
  runAtomic,
  rowCountOf,
} from "./ops";

/** SHA-256 (hex) of an invite token. Only the hash is stored; the plaintext lives only in the email link. */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Insert a fresh tree's graph rows (people → couples → parent-child, FK order). */
async function insertGraphRows(treeId: string, graph: FamilyTree): Promise<void> {
  const people = Object.values(graph.people);
  const couples = Object.values(graph.couples);
  const pcs = Object.values(graph.parentChildren);

  if (people.length > 0) {
    await db.insert(treePerson).values(
      people.map((p) => ({
        id: p.id,
        treeId,
        firstName: p.firstName,
        lastName: p.lastName,
        birthDate: p.birthDate ?? null,
        birthPlace: p.birthPlace ?? null,
        deathDate: p.deathDate ?? null,
        isDeceased: p.isDeceased,
        gender: p.gender,
        notes: p.notes ?? null,
        isPlaceholder: p.isPlaceholder ?? false,
      })),
    );
  }
  if (couples.length > 0) {
    await db.insert(treeCouple).values(
      couples.map((c) => ({
        id: c.id,
        treeId,
        partner1Id: c.partner1Id,
        partner2Id: c.partner2Id,
        status: c.status,
        startDate: c.startDate ?? null,
        endDate: c.endDate ?? null,
        marriagePlace: c.marriagePlace ?? null,
      })),
    );
  }
  if (pcs.length > 0) {
    await db.insert(treeParentChild).values(
      pcs.map((pc) => ({
        id: pc.id,
        treeId,
        childId: pc.childId,
        coupleId: pc.coupleId ?? null,
        singleParentId: pc.singleParentId ?? null,
        type: pc.type,
      })),
    );
  }
}

/**
 * A globally-unique, URL-safe slug derived from a tree name. Collisions get a
 * numeric suffix: "the-smiths", "the-smiths-2", "the-smiths-3", …
 */
async function generateUniqueTreeSlug(name: string): Promise<string> {
  const base = slugify(name);
  const taken = await db
    .select({ slug: trees.slug })
    .from(trees)
    .where(or(eq(trees.slug, base), like(trees.slug, `${base}-%`)));
  const used = new Set(taken.map((t) => t.slug));
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/** True for a Postgres unique-constraint violation on `trees.slug`. */
function isSlugUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: string }).code === "23505" &&
    (e as { constraint?: string }).constraint === "trees_slug_unique"
  );
}

/** True for a 23505 on the pending-invite partial unique index. */
function isPendingInviteUniqueViolation(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: string }).code === "23505" &&
    (e as { constraint?: string }).constraint === "tree_invitation_pending_email_uq"
  );
}

/**
 * Insert a tree, deriving a unique slug from its `name`. `generateUniqueTreeSlug`
 * reads-then-writes, so two concurrent creates of the same name can compute the
 * same slug before either commits; the DB unique constraint rejects the loser.
 * We catch that, recompute against the now-committed rows, and retry.
 */
async function insertTreeWithUniqueSlug(
  values: Omit<typeof trees.$inferInsert, "slug">,
): Promise<string> {
  const MAX_ATTEMPTS = 5;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const slug = await generateUniqueTreeSlug(values.name);
    try {
      await db.insert(trees).values({ ...values, slug });
      return slug;
    } catch (e) {
      if (isSlugUniqueViolation(e) && attempt < MAX_ATTEMPTS) continue;
      throw e;
    }
  }
  // Unreachable: the loop always returns or throws.
  throw new Error("Could not generate a unique tree slug");
}

/** Create a new tree owned by the current user. Returns the new tree's slug. */
export async function createTree(name?: string): Promise<string> {
  const session = await requireAuth();
  const trimmed = name?.trim() || "My Family";
  const slug = await insertTreeWithUniqueSlug({
    id: nanoid(),
    name: trimmed,
    ownerId: session.user.id,
    version: 1,
  });
  revalidatePath("/tree");
  return slug;
}

/**
 * Create a tree pre-filled with the generated demo family. Surfaced in the
 * gallery to super admins only.
 */
export async function createDemoTree(): Promise<string> {
  const session = await requireAuth();
  if (!isSuperAdmin(session.user.role)) {
    throw new Error("Not authorized");
  }
  const id = nanoid();
  const graph: FamilyTree = { ...buildMockFamily(), collapsed: [] };
  const slug = await insertTreeWithUniqueSlug({
    id,
    name: "Demo Family",
    ownerId: session.user.id,
    version: 1,
    collapsed: graph.collapsed,
  });
  await insertGraphRows(id, graph);
  revalidatePath("/tree");
  return slug;
}

export async function renameTree(id: string, name: string): Promise<void> {
  await requireTreeOwner(id);
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Tree name cannot be empty");
  await db
    .update(trees)
    .set({ name: trimmed, updatedAt: new Date() })
    .where(eq(trees.id, id));
  revalidatePath("/tree");
}

export async function deleteTree(id: string): Promise<void> {
  await requireTreeOwner(id);
  // R2 objects are not covered by FK cascade — purge them first so we don't
  // leave orphaned files if the DB delete succeeds but R2 is unreachable later.
  await deleteByPrefix(`trees/${id}/`);
  // Memberships, media_asset, revisions, and all graph rows cascade via FK.
  await db.delete(trees).where(eq(trees.id, id));
  revalidatePath("/tree");
}

// ── Graph persistence (op-log with optimistic concurrency) ───────────────────

/** Result of an `applyTreeOps` flush. */
export type ApplyResult =
  | { version: number }
  | { conflict: true; version: number; graph: NamedFamilyTree }
  | { error: string };

// A revision snapshot is taken at most this often per tree, and only the newest
// N are kept. Cheap safety net + owner-restore source without ballooning storage.
const REVISION_THROTTLE_MS = 30 * 60 * 1000;
const REVISION_KEEP = 20;

const graphOf = (t: NamedFamilyTree): FamilyTree => ({
  people: t.people,
  couples: t.couples,
  parentChildren: t.parentChildren,
  collapsed: t.collapsed,
});

/** Best-effort R2 purge of specific keys (fire-and-forget on the success path). */
async function purgeKeys(keys: string[]): Promise<void> {
  await Promise.allSettled(keys.map((k) => deleteObject(k)));
}

/** Best-effort retention prune: keep only the newest `REVISION_KEEP` revisions. */
async function pruneRevisions(treeId: string): Promise<void> {
  await db.execute(sql`
    delete from tree_revision
    where tree_id = ${treeId}
      and id not in (
        select id from tree_revision
        where tree_id = ${treeId}
        order by created_at desc
        limit ${REVISION_KEEP}
      )
  `);
}

/**
 * Apply a batch of graph mutations atomically under optimistic concurrency.
 *
 * `baseVersion` is the tree version the client last saw. All versioned ops are
 * gated on it and run before a single `version + 1` bump; if the tree has moved
 * on, every op no-ops and the bump matches 0 rows, which we report as a conflict
 * (with the latest graph so the client can reload). `set_collapsed` is applied
 * unconditionally (canvas state, last-write-wins, no version bump).
 */
export async function applyTreeOps(
  treeId: string,
  rawOps: unknown,
  baseVersion: number,
): Promise<ApplyResult> {
  const { session } = await requireTreeEdit(treeId);

  const parsed = parseOps(rawOps);
  if ("error" in parsed) return { error: parsed.error };
  const ops = parsed.ops;

  const { preBump, bump, postBump, versionedCount } = planStatements(
    treeId,
    baseVersion,
    ops,
  );

  // Media rows/objects for people being removed this flush: read their keys now
  // (before the rows go), delete the rows inside the atomic unit, purge R2 after.
  const personDeletes = ops
    .filter((o): o is Extract<typeof o, { t: "delete_person" }> => o.t === "delete_person")
    .map((o) => o.id);
  const clearAll = ops.some((o) => o.t === "clear_tree");
  let keysToPurge: string[] = [];
  if (clearAll || personDeletes.length > 0) {
    const rows = await db
      .select({ key: mediaAsset.key })
      .from(mediaAsset)
      .where(
        clearAll
          ? and(eq(mediaAsset.treeId, treeId), isNotNull(mediaAsset.personId))
          : and(
              eq(mediaAsset.treeId, treeId),
              inArray(mediaAsset.personId, personDeletes),
            ),
      );
    keysToPurge = rows.map((r) => r.key);
  }
  const mediaCleanup = mediaCleanupStmts(treeId, baseVersion, personDeletes, clearAll);

  // Throttled pre-apply revision snapshot (only when we're changing the graph).
  let revision = null as ReturnType<typeof revisionStmt> | null;
  if (versionedCount > 0) {
    const [latest] = await db
      .select({ newest: max(treeRevision.createdAt) })
      .from(treeRevision)
      .where(eq(treeRevision.treeId, treeId));
    const newest = latest?.newest ?? null;
    const stale = !newest || Date.now() - newest.getTime() > REVISION_THROTTLE_MS;
    if (stale) {
      const current = await getTreeGraphById(treeId);
      if (current) {
        revision = revisionStmt(
          treeId,
          baseVersion,
          nanoid(),
          current.version,
          graphOf(current),
          "auto",
          session.user.id,
        );
      }
    }
  }

  // Ordered atomic plan: [revision?, media-cleanup…, ops…, bump?, set_collapsed?].
  const pre = [
    ...(revision ? [revision] : []),
    ...mediaCleanup,
    ...preBump,
  ];
  const plan = [...pre, ...(bump ? [bump] : []), ...postBump];
  const bumpIndex = bump ? pre.length : -1;

  if (plan.length === 0) return { version: baseVersion };

  let results;
  try {
    results = await runAtomic(plan);
  } catch (e) {
    console.error("applyTreeOps failed", e);
    return { error: "Couldn't save your changes." };
  }

  // Conflict: the bump matched no row → baseVersion was stale, everything no-op'd.
  if (bumpIndex >= 0 && rowCountOf(results[bumpIndex]) === 0) {
    const graph = await getTreeGraphById(treeId);
    if (!graph) return { error: "This tree no longer exists." };
    return { conflict: true, version: graph.version, graph };
  }

  if (keysToPurge.length > 0) void purgeKeys(keysToPurge);
  if (revision) void pruneRevisions(treeId);

  return { version: versionedCount > 0 ? baseVersion + 1 : baseVersion };
}

/** Re-fetch the authoritative graph (used by the client after a conflict). Requires view access. */
export async function refetchTreeGraph(treeId: string): Promise<NamedFamilyTree | null> {
  await requireTreeView(treeId);
  return getTreeGraphById(treeId);
}

/**
 * Restore a tree to a prior revision. Owner only. Snapshots the current state as
 * a `pre_restore` revision, then atomically replaces all graph rows with the
 * revision's contents and bumps the version (so any open editor conflicts and
 * reloads on its next flush).
 */
export async function restoreTreeRevision(
  revisionId: string,
): Promise<{ error?: string; version?: number }> {
  const [rev] = await db
    .select()
    .from(treeRevision)
    .where(eq(treeRevision.id, revisionId))
    .limit(1);
  if (!rev) return { error: "Revision not found." };

  const { session } = await requireTreeOwner(rev.treeId);
  const treeId = rev.treeId;
  const snapshot = rev.data;

  const current = await getTreeGraphById(treeId);
  if (!current) return { error: "Tree not found." };

  const people = Object.values(snapshot.people ?? {});
  const couples = Object.values(snapshot.couples ?? {});
  const pcs = Object.values(snapshot.parentChildren ?? {});

  const personRows = people.map((p) => ({
    id: p.id,
    treeId,
    firstName: p.firstName,
    lastName: p.lastName,
    birthDate: p.birthDate ?? null,
    birthPlace: p.birthPlace ?? null,
    deathDate: p.deathDate ?? null,
    isDeceased: p.isDeceased,
    gender: p.gender,
    notes: p.notes ?? null,
    isPlaceholder: p.isPlaceholder ?? false,
  }));
  const coupleRows = couples.map((c) => ({
    id: c.id,
    treeId,
    partner1Id: c.partner1Id,
    partner2Id: c.partner2Id,
    status: c.status,
    startDate: c.startDate ?? null,
    endDate: c.endDate ?? null,
    marriagePlace: c.marriagePlace ?? null,
  }));
  const pcRows = pcs.map((pc) => ({
    id: pc.id,
    treeId,
    childId: pc.childId,
    coupleId: pc.coupleId ?? null,
    singleParentId: pc.singleParentId ?? null,
    type: pc.type,
  }));

  // Ordered statements (delete children → parents, then insert parents →
  // children) built against whichever executor runs them. Queries must bind to
  // the transaction on the local driver, so we build per-executor.
  type Exec = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];
  const build = (exec: Exec) =>
    [
      exec.insert(treeRevision).values({
        id: nanoid(),
        treeId,
        version: current.version,
        data: graphOf(current),
        reason: "pre_restore" as const,
        createdBy: session.user.id,
      }),
      exec.delete(treeParentChild).where(eq(treeParentChild.treeId, treeId)),
      exec.delete(treeCouple).where(eq(treeCouple.treeId, treeId)),
      exec.delete(treePerson).where(eq(treePerson.treeId, treeId)),
      ...(personRows.length ? [exec.insert(treePerson).values(personRows)] : []),
      ...(coupleRows.length ? [exec.insert(treeCouple).values(coupleRows)] : []),
      ...(pcRows.length ? [exec.insert(treeParentChild).values(pcRows)] : []),
      exec
        .update(trees)
        .set({
          version: sql`${trees.version} + 1`,
          collapsed: snapshot.collapsed ?? [],
          updatedAt: new Date(),
        })
        .where(eq(trees.id, treeId)),
    ];

  if (isNeonHttp(db)) {
    const stmts = build(db);
    await db.batch(
      stmts as unknown as [(typeof stmts)[number], ...(typeof stmts)[number][]],
    );
  } else {
    await db.transaction(async (tx) => {
      for (const s of build(tx)) await s;
    });
  }

  return { version: current.version + 1 };
}

// ── Membership management (owner only) ───────────────────────────────────────
export interface MemberInfo {
  userId: string;
  name: string;
  email: string;
  role: TreeRole;
  isOwner: boolean;
}

/** List the owner + collaborators of a tree. Requires view access. */
export async function listMembers(treeId: string): Promise<MemberInfo[]> {
  const { tree } = await requireTreeView(treeId);

  const [[owner], collaborators] = await Promise.all([
    db
      .select({ id: user.id, name: user.name, email: user.email })
      .from(user)
      .where(eq(user.id, tree.ownerId))
      .limit(1),
    db
      .select({
        userId: treeMembership.userId,
        role: treeMembership.role,
        name: user.name,
        email: user.email,
      })
      .from(treeMembership)
      .innerJoin(user, eq(user.id, treeMembership.userId))
      .where(eq(treeMembership.treeId, treeId)),
  ]);

  const members: MemberInfo[] = [];
  if (owner) {
    members.push({
      userId: owner.id,
      name: owner.name,
      email: owner.email,
      role: "owner",
      isOwner: true,
    });
  }
  for (const c of collaborators) {
    if (c.userId === tree.ownerId) continue;
    members.push({
      userId: c.userId,
      name: c.name,
      email: c.email,
      role: (c.role as TreeRole) ?? "member",
      isOwner: false,
    });
  }
  return members;
}

/** Add a collaborator by email. Owner only. */
export async function addMember(
  treeId: string,
  email: string,
  role: TreeRole,
): Promise<{ error?: string }> {
  const { tree } = await requireTreeOwner(treeId);
  if (!TREE_ROLES.includes(role)) return { error: "Invalid role" };

  const normalized = email.trim().toLowerCase();
  if (!normalized) return { error: "Enter an email address" };

  const [target] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, normalized))
    .limit(1);
  if (!target) return { error: "No account with that email" };
  if (target.id === tree.ownerId) return { error: "That user owns this tree" };

  const [existing] = await db
    .select({ id: treeMembership.id })
    .from(treeMembership)
    .where(
      and(
        eq(treeMembership.treeId, treeId),
        eq(treeMembership.userId, target.id),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(treeMembership)
      .set({ role })
      .where(eq(treeMembership.id, existing.id));
  } else {
    await db.insert(treeMembership).values({
      id: nanoid(),
      treeId,
      userId: target.id,
      role,
    });
  }
  return {};
}

export async function updateMemberRole(
  treeId: string,
  userId: string,
  role: TreeRole,
): Promise<{ error?: string }> {
  await requireTreeOwner(treeId);
  if (!TREE_ROLES.includes(role)) return { error: "Invalid role" };
  await db
    .update(treeMembership)
    .set({ role })
    .where(
      and(
        eq(treeMembership.treeId, treeId),
        eq(treeMembership.userId, userId),
      ),
    );
  return {};
}

export async function removeMember(
  treeId: string,
  userId: string,
): Promise<void> {
  await requireTreeOwner(treeId);
  await db
    .delete(treeMembership)
    .where(
      and(
        eq(treeMembership.treeId, treeId),
        eq(treeMembership.userId, userId),
      ),
    );
}

// ── Invitations ───────────────────────────────────────────────────────────────

export interface InvitationInfo {
  id: string;
  email: string;
  role: TreeRole;
  expiresAt: Date;
  createdAt: Date;
}

const INVITE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Invite someone by email. If they already have an account and aren't a member
 * yet, adds them directly and returns `{ added: true }`. Otherwise generates a
 * token link they can use after signing up and returns `{ inviteUrl }`.
 */
export async function inviteMember(
  treeId: string,
  email: string,
  role: TreeRole,
): Promise<{ added?: true; inviteUrl?: string; error?: string }> {
  const { tree, session } = await requireTreeOwner(treeId);
  if (!TREE_ROLES.includes(role)) return { error: "Invalid role" };

  const normalized = email.trim().toLowerCase();
  if (!normalized) return { error: "Enter an email address" };

  const [target] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, normalized))
    .limit(1);

  if (target) {
    if (target.id === tree.ownerId) return { error: "That user owns this tree" };

    const [existing] = await db
      .select({ id: treeMembership.id })
      .from(treeMembership)
      .where(
        and(
          eq(treeMembership.treeId, treeId),
          eq(treeMembership.userId, target.id),
        ),
      )
      .limit(1);

    if (existing) return { error: "That user is already a member" };

    await db.insert(treeMembership).values({
      id: nanoid(),
      treeId,
      userId: target.id,
      role,
    });
    return { added: true };
  }

  // No account yet — create (or refresh) a pending invitation.
  const [existingInvite] = await db
    .select({ id: treeInvitation.id })
    .from(treeInvitation)
    .where(
      and(
        eq(treeInvitation.treeId, treeId),
        eq(treeInvitation.email, normalized),
        isNull(treeInvitation.acceptedAt),
      ),
    )
    .limit(1);

  const token = nanoid(32);
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS);

  if (existingInvite) {
    await db
      .update(treeInvitation)
      .set({ tokenHash, role, expiresAt })
      .where(eq(treeInvitation.id, existingInvite.id));
  } else {
    try {
      await db.insert(treeInvitation).values({
        id: nanoid(),
        treeId,
        email: normalized,
        role,
        tokenHash,
        invitedById: session.user.id,
        expiresAt,
      });
    } catch (e) {
      // A concurrent invite for the same (tree, email) lost the race to the
      // partial unique index; refresh the now-existing pending row instead.
      if (!isPendingInviteUniqueViolation(e)) throw e;
      await db
        .update(treeInvitation)
        .set({ tokenHash, role, expiresAt })
        .where(
          and(
            eq(treeInvitation.treeId, treeId),
            eq(treeInvitation.email, normalized),
            isNull(treeInvitation.acceptedAt),
          ),
        );
    }
  }

  const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  const inviteUrl = `${base}/join?token=${token}`;
  void sendInviteEmail(normalized, inviteUrl, tree.name, session.user.name);
  return { inviteUrl };
}

/** List non-expired, non-accepted invitations for a tree. Owner only. */
export async function listInvitations(treeId: string): Promise<InvitationInfo[]> {
  await requireTreeOwner(treeId);

  const rows = await db
    .select({
      id: treeInvitation.id,
      email: treeInvitation.email,
      role: treeInvitation.role,
      expiresAt: treeInvitation.expiresAt,
      createdAt: treeInvitation.createdAt,
    })
    .from(treeInvitation)
    .where(
      and(
        eq(treeInvitation.treeId, treeId),
        isNull(treeInvitation.acceptedAt),
        gt(treeInvitation.expiresAt, new Date()),
      ),
    )
    .orderBy(desc(treeInvitation.createdAt));

  return rows.map((r) => ({ ...r, role: r.role as TreeRole }));
}

/** Delete a pending invitation. Owner only. */
export async function revokeInvitation(invitationId: string): Promise<void> {
  const [inv] = await db
    .select({ treeId: treeInvitation.treeId })
    .from(treeInvitation)
    .where(eq(treeInvitation.id, invitationId))
    .limit(1);
  if (!inv) return;
  await requireTreeOwner(inv.treeId);
  await db.delete(treeInvitation).where(eq(treeInvitation.id, invitationId));
}

/**
 * Accept an invitation. The calling user's email must match the invite.
 * Returns the treeId on success so the client can redirect.
 */
export async function acceptInvitation(
  token: string,
): Promise<{ treeId?: string; error?: string }> {
  const session = await requireAuth();

  const [inv] = await db
    .select()
    .from(treeInvitation)
    .where(
      and(
        eq(treeInvitation.tokenHash, hashToken(token)),
        isNull(treeInvitation.acceptedAt),
        gt(treeInvitation.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!inv) return { error: "This invite link is invalid or has expired." };
  if (inv.email !== session.user.email) {
    return {
      error: `This invite is for ${inv.email}. You're signed in as ${session.user.email}.`,
    };
  }

  const [tree] = await db
    .select({ ownerId: trees.ownerId })
    .from(trees)
    .where(eq(trees.id, inv.treeId))
    .limit(1);

  if (!tree) return { error: "The family tree no longer exists." };
  if (tree.ownerId === session.user.id) return { error: "You already own this tree." };

  // Membership insert and invite-consume commit together. `onConflictDoNothing`
  // makes the insert idempotent (already a member), removing the read-then-write
  // window the old two-step version had.
  const insertMembership = db
    .insert(treeMembership)
    .values({
      id: nanoid(),
      treeId: inv.treeId,
      userId: session.user.id,
      role: inv.role,
    })
    .onConflictDoNothing();
  const consumeInvite = db
    .update(treeInvitation)
    .set({ acceptedAt: new Date() })
    .where(eq(treeInvitation.id, inv.id));

  if (isNeonHttp(db)) {
    await db.batch([insertMembership, consumeInvite]);
  } else {
    await db.transaction(async (tx) => {
      await tx
        .insert(treeMembership)
        .values({
          id: nanoid(),
          treeId: inv.treeId,
          userId: session.user.id,
          role: inv.role,
        })
        .onConflictDoNothing();
      await tx
        .update(treeInvitation)
        .set({ acceptedAt: new Date() })
        .where(eq(treeInvitation.id, inv.id));
    });
  }

  return { treeId: inv.treeId };
}
