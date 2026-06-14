import "server-only";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Cloudflare R2 (S3-compatible) access. The bucket is private — nothing is ever
 * served publicly. Browsers upload and download directly via short-lived
 * presigned URLs minted here on the server, so files never pass through Next.
 */

/** How long presigned URLs stay valid (seconds). Short by design. */
const PRESIGN_TTL = 300;

// Lazily created so a missing/placeholder config only fails when R2 is actually
// used (not at import time — which would crash unrelated pages and the build).
let cached: { client: S3Client; bucket: string } | null = null;

function r2(): { client: S3Client; bucket: string } {
  if (cached) return cached;
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error(
      "R2 is not configured: set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET",
    );
  }
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  cached = { client, bucket };
  return cached;
}

/** Presigned PUT URL the browser uploads to directly. */
export function presignUpload(key: string, contentType: string): Promise<string> {
  const { client, bucket } = r2();
  return getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
    { expiresIn: PRESIGN_TTL, signableHeaders: new Set(["content-type"]) },
  );
}

/**
 * Presigned GET URL for viewing/downloading. Pass `downloadName` to force a
 * browser download with that filename (Content-Disposition: attachment).
 */
export function presignDownload(
  key: string,
  downloadName?: string,
): Promise<string> {
  const { client, bucket } = r2();
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ...(downloadName
        ? {
            ResponseContentDisposition: `attachment; filename="${downloadName.replace(/"/g, "")}"`,
          }
        : {}),
    }),
    { expiresIn: PRESIGN_TTL },
  );
}

/** Permanently remove an object. Best-effort; callers ignore "not found". */
export async function deleteObject(key: string): Promise<void> {
  const { client, bucket } = r2();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

// ── Object key builders ───────────────────────────────────────────────────────
// Foldered per tree / member so the bucket stays browsable:
//   trees/<treeId>/members/<personId>/profile/<assetId>.<ext>
//   trees/<treeId>/members/<personId>/documents/<assetId>.<ext>
//   trees/<treeId>/gallery/<assetId>.<ext>

/** Lowercase extension (no dot) inferred from a filename, or "bin". */
export function extOf(fileName: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(fileName);
  return m ? m[1].toLowerCase() : "bin";
}

export function profileKey(treeId: string, personId: string, assetId: string, ext: string): string {
  return `trees/${treeId}/members/${personId}/profile/${assetId}.${ext}`;
}

export function documentKey(treeId: string, personId: string, assetId: string, ext: string): string {
  return `trees/${treeId}/members/${personId}/documents/${assetId}.${ext}`;
}

export function galleryKey(treeId: string, assetId: string, ext: string): string {
  return `trees/${treeId}/gallery/${assetId}.${ext}`;
}
