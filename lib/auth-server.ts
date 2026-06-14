import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canViewTree, isSuperAdmin } from "@/lib/permissions";

/** Current session (with user) for the incoming request, or null. */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/**
 * Gate a route on tree access (MEMBER+). Redirects unauthenticated users to
 * `/login` and signed-in users without access to `/access-pending`.
 * Returns the session on success.
 */
export async function requireTreeAccess() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canViewTree(session.user.role)) redirect("/access-pending");
  return session;
}

/** Gate a route on the system-administrator role. */
export async function requireSuperAdmin() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isSuperAdmin(session.user.role)) redirect("/tree");
  return session;
}
