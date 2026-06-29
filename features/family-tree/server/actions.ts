"use server";

import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { and, eq, isNull, gt, desc } from "drizzle-orm";
import { db } from "@/db";
import { trees, treeMembership, peopleIndex, user, treeInvitation } from "@/db/schema";
import { requireAuth } from "@/lib/auth-server";
import {
  requireTreeEdit,
  requireTreeOwner,
  requireTreeView,
} from "@/lib/tree-access";
import { TREE_ROLES, type TreeRole } from "@/lib/permissions";
import type { FamilyTree } from "@/features/family-tree/types";
import { personDisplayName } from "@/features/family-tree/utils/person";
import { buildMockFamily } from "@/features/family-tree/utils/mockData";
import { deleteByPrefix } from "@/lib/r2";

const emptyTree = (): FamilyTree => ({
  people: {},
  couples: {},
  parentChildren: {},
  collapsed: [],
});

/** Rebuild the searchable people index for a tree from its JSONB graph. */
async function rebuildPeopleIndex(treeId: string, data: FamilyTree) {
  await db.delete(peopleIndex).where(eq(peopleIndex.treeId, treeId));
  const rows = Object.values(data.people ?? {}).map((p) => {
    const year = p.birthDate ? Number.parseInt(p.birthDate.slice(0, 4), 10) : NaN;
    return {
      id: p.id,
      treeId,
      personName: personDisplayName(p),
      birthYear: Number.isFinite(year) ? year : null,
      gender: p.gender ?? null,
    };
  });
  if (rows.length > 0) await db.insert(peopleIndex).values(rows);
}

/** Create a new tree owned by the current user. Returns the new tree id. */
export async function createTree(name?: string): Promise<string> {
  const session = await requireAuth();
  const id = nanoid();
  const trimmed = name?.trim() || "My Family";
  await db.insert(trees).values({
    id,
    name: trimmed,
    ownerId: session.user.id,
    data: emptyTree(),
  });
  revalidatePath("/tree");
  return id;
}

/**
 * Dev helper: create a tree pre-filled with the generated demo family. Surfaced
 * only in development from the gallery.
 */
export async function createDemoTree(): Promise<string> {
  const session = await requireAuth();
  const id = nanoid();
  const data: FamilyTree = { ...buildMockFamily(), collapsed: [] };
  await db.insert(trees).values({
    id,
    name: "Demo Family",
    ownerId: session.user.id,
    data,
  });
  await rebuildPeopleIndex(id, data);
  revalidatePath("/tree");
  return id;
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
  // Memberships, media_asset, and people_index rows cascade via FK on delete.
  await db.delete(trees).where(eq(trees.id, id));
  revalidatePath("/tree");
}

/** Persist the full tree graph (editor+) and rebuild the people index. */
export async function saveTreeData(id: string, data: FamilyTree): Promise<void> {
  await requireTreeEdit(id);
  await db
    .update(trees)
    .set({ data, updatedAt: new Date() })
    .where(eq(trees.id, id));
  await rebuildPeopleIndex(id, data);
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

  const [owner] = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, tree.ownerId))
    .limit(1);

  const collaborators = await db
    .select({
      userId: treeMembership.userId,
      role: treeMembership.role,
      name: user.name,
      email: user.email,
    })
    .from(treeMembership)
    .innerJoin(user, eq(user.id, treeMembership.userId))
    .where(eq(treeMembership.treeId, treeId));

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
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS);

  if (existingInvite) {
    await db
      .update(treeInvitation)
      .set({ token, role, expiresAt })
      .where(eq(treeInvitation.id, existingInvite.id));
  } else {
    await db.insert(treeInvitation).values({
      id: nanoid(),
      treeId,
      email: normalized,
      role,
      token,
      invitedById: session.user.id,
      expiresAt,
    });
  }

  const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  return { inviteUrl: `${base}/join?token=${token}` };
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
        eq(treeInvitation.token, token),
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

  const [existing] = await db
    .select({ id: treeMembership.id })
    .from(treeMembership)
    .where(
      and(
        eq(treeMembership.treeId, inv.treeId),
        eq(treeMembership.userId, session.user.id),
      ),
    )
    .limit(1);

  if (!existing) {
    await db.insert(treeMembership).values({
      id: nanoid(),
      treeId: inv.treeId,
      userId: session.user.id,
      role: inv.role,
    });
  }

  await db
    .update(treeInvitation)
    .set({ acceptedAt: new Date() })
    .where(eq(treeInvitation.id, inv.id));

  return { treeId: inv.treeId };
}
