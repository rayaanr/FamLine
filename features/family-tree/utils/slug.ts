/**
 * Turn a free-text tree name into a URL-safe slug: lowercase, ASCII letters /
 * digits / hyphens only, no leading/trailing or doubled hyphens. Accents are
 * decomposed (NFKD) so "José" → "jose". Falls back to "family" when the name
 * has no usable characters (e.g. emoji-only).
 */
export function slugify(name: string): string {
  const slug = name
    .normalize("NFKD") // split accented letters into base char + combining mark
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // any run of non-alphanumerics (incl. marks) → hyphen
    .replace(/^-+|-+$/g, ""); // trim leading/trailing hyphens
  return slug || "family";
}
