import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/permissions";

/** Current session (with user) for the incoming request, or null. */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/**
 * Gate a route on being signed in. Tree access itself is resolved per-tree in
 * `lib/tree-access.ts`; a signed-in user with no memberships simply sees an
 * empty gallery. Redirects unauthenticated users to `/login`.
 */
export async function requireAuth() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Gate a route on the system-administrator role. */
export async function requireSuperAdmin() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isSuperAdmin(session.user.role)) redirect("/tree");
  return session;
}
