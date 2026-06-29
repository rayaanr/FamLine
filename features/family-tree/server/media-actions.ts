"use server";

import { nanoid } from "nanoid";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { mediaAsset, trees } from "@/db/schema";
import {
  requireTreeEdit,
  requireTreeView,
  requireTreeOwner,
} from "@/lib/tree-access";
import { canEditTree } from "@/lib/permissions";
import {
  presignUpload,
  presignDownload,
  deleteObject,
  headObject,
  profileKey,
  documentKey,
  extOf,
} from "@/lib/r2";
import {
  type DocType,
  type MediaKind,
  type MediaAssetView,
  type DocumentVisibility,
} from "@/features/family-tree/types";

const MB = 1024 * 1024;
const MAX_IMAGE = 10 * MB;
const MAX_DOC = 25 * MB;

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);
const DOC_TYPES_MIME = new Set([...IMAGE_TYPES, "application/pdf"]);

interface UploadSpec {
  treeId: string;
  kind: MediaKind;
  personId?: string;
  docType?: DocType;
  fileName: string;
  contentType: string;
  size: number;
}

/** Validate an upload request; returns an error string or null. */
function validateSpec(spec: UploadSpec): string | null {
  if (!spec.fileName || !spec.contentType) return "Missing file info";
  if (!Number.isFinite(spec.size) || spec.size <= 0) return "Empty file";

  if (spec.kind === "document") {
    if (!spec.personId) return "Missing member";
    if (!DOC_TYPES_MIME.has(spec.contentType))
      return "Documents must be an image or PDF";
    if (spec.size > MAX_DOC) return "File is larger than 25MB";
    return null;
  }

  if (spec.kind === "profile" && !spec.personId) return "Missing member";
  if (!IMAGE_TYPES.has(spec.contentType)) return "Photos must be an image";
  if (spec.size > MAX_IMAGE) return "Image is larger than 10MB";
  return null;
}

/** Deterministic R2 key for an asset, derived from its own fields (never the client). */
function keyFor(spec: UploadSpec, assetId: string): string {
  const ext = extOf(spec.fileName);
  if (spec.kind === "profile")
    return profileKey(spec.treeId, spec.personId!, assetId, ext);
  return documentKey(spec.treeId, spec.personId!, assetId, ext);
}

export interface UploadTicket {
  assetId: string;
  uploadUrl: string;
}

/**
 * Step 1 of an upload: validate, mint a presigned PUT URL the browser uploads
 * to directly. The DB row is written only once the upload is confirmed.
 */
export async function requestUpload(
  spec: UploadSpec,
): Promise<{ ticket?: UploadTicket; error?: string }> {
  await requireTreeEdit(spec.treeId);
  const err = validateSpec(spec);
  if (err) return { error: err };

  const assetId = nanoid();
  const key = keyFor(spec, assetId);
  const uploadUrl = await presignUpload(key, spec.contentType);
  return { ticket: { assetId, uploadUrl } };
}

/**
 * Step 2: record the asset after the browser has PUT it to R2. For profile
 * photos, any previous photo (DB row + R2 object) is replaced so there's one.
 */
export async function confirmUpload(
  spec: UploadSpec & { assetId: string },
): Promise<{ error?: string }> {
  const { session } = await requireTreeEdit(spec.treeId);
  // Basic shape validation (kind, personId, fileName) — not size/type, those
  // are verified against the actual object below.
  if (!spec.fileName) return { error: "Missing file info" };
  if (spec.kind === "profile" && !spec.personId) return { error: "Missing member" };
  if (spec.kind === "document" && !spec.personId) return { error: "Missing member" };

  const key = keyFor(spec, spec.assetId);

  // Verify what actually landed in R2 — never trust the client-reported size/type.
  const meta = await headObject(key);
  if (!meta) return { error: "Upload not found — please try again" };

  const maxBytes = spec.kind === "document" ? MAX_DOC : MAX_IMAGE;
  if (meta.contentLength > maxBytes) {
    await deleteObject(key).catch(() => {});
    return {
      error:
        spec.kind === "document" ? "File is larger than 25MB" : "Image is larger than 10MB",
    };
  }

  const allowedTypes = spec.kind === "document" ? DOC_TYPES_MIME : IMAGE_TYPES;
  if (!allowedTypes.has(meta.contentType)) {
    await deleteObject(key).catch(() => {});
    return {
      error:
        spec.kind === "document"
          ? "Documents must be an image or PDF"
          : "Photos must be an image",
    };
  }

  if (spec.kind === "profile") {
    const old = await db
      .select({ id: mediaAsset.id, key: mediaAsset.key })
      .from(mediaAsset)
      .where(
        and(
          eq(mediaAsset.treeId, spec.treeId),
          eq(mediaAsset.personId, spec.personId!),
          eq(mediaAsset.kind, "profile"),
        ),
      );
    if (old.length > 0) {
      await Promise.allSettled(old.map((o) => deleteObject(o.key)));
      await db.delete(mediaAsset).where(
        inArray(
          mediaAsset.id,
          old.map((o) => o.id),
        ),
      );
    }
  }

  await db.insert(mediaAsset).values({
    id: spec.assetId,
    treeId: spec.treeId,
    personId: spec.personId ?? null,
    kind: spec.kind,
    docType: spec.kind === "document" ? (spec.docType ?? "other") : null,
    key,
    fileName: spec.fileName,
    contentType: meta.contentType,
    size: meta.contentLength,
    uploadedBy: session.user.id,
  });

  return {};
}

type AssetRow = typeof mediaAsset.$inferSelect;

async function toView(row: AssetRow): Promise<MediaAssetView> {
  return {
    id: row.id,
    kind: row.kind,
    docType: row.docType,
    fileName: row.fileName,
    contentType: row.contentType,
    size: row.size,
    createdAt: row.createdAt.toISOString(),
    url: await presignDownload(row.key),
  };
}

/**
 * A member's profile photo (if any) + documents. Documents are withheld unless
 * the viewer can edit, or the tree allows members to see documents.
 */
export async function listMemberMedia(
  treeId: string,
  personId: string,
): Promise<{ profile: MediaAssetView | null; documents: MediaAssetView[] }> {
  const { tree, role } = await requireTreeView(treeId);
  const rows = await db
    .select()
    .from(mediaAsset)
    .where(and(eq(mediaAsset.treeId, treeId), eq(mediaAsset.personId, personId)))
    .orderBy(asc(mediaAsset.createdAt));

  const canSeeDocs =
    canEditTree(role) || tree.settings.documentVisibility === "members";

  const profileRow = rows.find((r) => r.kind === "profile") ?? null;
  const docRows = canSeeDocs ? rows.filter((r) => r.kind === "document") : [];

  return {
    profile: profileRow ? await toView(profileRow) : null,
    documents: await Promise.all(docRows.map(toView)),
  };
}

/** Map of personId → presigned profile-photo URL for every member with one. */
export async function listProfilePhotos(
  treeId: string,
): Promise<Record<string, string>> {
  await requireTreeView(treeId);
  const rows = await db
    .select({ personId: mediaAsset.personId, key: mediaAsset.key })
    .from(mediaAsset)
    .where(and(eq(mediaAsset.treeId, treeId), eq(mediaAsset.kind, "profile")));
  const entries = await Promise.all(
    rows
      .filter((r): r is { personId: string; key: string } => r.personId !== null)
      .map(async (r) => [r.personId, await presignDownload(r.key)] as const),
  );
  return Object.fromEntries(entries);
}

async function loadAsset(assetId: string): Promise<AssetRow | null> {
  const [row] = await db
    .select()
    .from(mediaAsset)
    .where(eq(mediaAsset.id, assetId))
    .limit(1);
  return row ?? null;
}

/** A presigned URL that forces a download of the original file (editor/visibility checked). */
export async function getDownloadUrl(
  assetId: string,
): Promise<{ url?: string; error?: string }> {
  const asset = await loadAsset(assetId);
  if (!asset) return { error: "Not found" };
  const { tree, role } = await requireTreeView(asset.treeId);

  if (asset.kind === "document") {
    const canSeeDocs =
      canEditTree(role) || tree.settings.documentVisibility === "members";
    if (!canSeeDocs) return { error: "Not allowed" };
  }

  return { url: await presignDownload(asset.key, asset.fileName) };
}

/** Delete an asset's R2 object and its row. Editor+. */
export async function deleteMedia(assetId: string): Promise<{ error?: string }> {
  const asset = await loadAsset(assetId);
  if (!asset) return {};
  await requireTreeEdit(asset.treeId);
  await deleteObject(asset.key).catch(() => {});
  await db.delete(mediaAsset).where(eq(mediaAsset.id, assetId));
  return {};
}

/** Read a tree's settings (view access). */
export async function getTreeSettings(
  treeId: string,
): Promise<{ documentVisibility: DocumentVisibility }> {
  const { tree } = await requireTreeView(treeId);
  return { documentVisibility: tree.settings.documentVisibility };
}

/** Update who may view documents. Owner only. */
export async function updateTreeSettings(
  treeId: string,
  settings: { documentVisibility: DocumentVisibility },
): Promise<{ error?: string }> {
  const { tree } = await requireTreeOwner(treeId);
  if (
    settings.documentVisibility !== "editors" &&
    settings.documentVisibility !== "members"
  )
    return { error: "Invalid setting" };
  await db
    .update(trees)
    .set({
      settings: { ...tree.settings, documentVisibility: settings.documentVisibility },
    })
    .where(eq(trees.id, treeId));
  return {};
}
