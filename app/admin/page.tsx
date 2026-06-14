import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { UserMenu } from '@/components/auth/UserMenu'
import {
  UserManagement,
  type AdminUser,
} from '@/components/admin/UserManagement'
import { auth } from '@/lib/auth'
import { requireSuperAdmin } from '@/lib/auth-server'

export const metadata: Metadata = {
  title: 'User management — FamLine',
}

export default async function AdminPage() {
  const session = await requireSuperAdmin()

  const { users } = await auth.api.listUsers({
    headers: await headers(),
    query: { limit: 200, sortBy: 'createdAt', sortDirection: 'desc' },
  })

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <Link href="/" className="font-heading text-lg font-bold text-foreground">
          FamLine
        </Link>
        <UserMenu />
      </header>
      <main className="mx-auto w-full max-w-4xl p-6">
        <Card>
          <CardHeader>
            <CardTitle>User management</CardTitle>
            <CardDescription>
              Assign roles and manage access. Members and above can view trees;
              editors can edit, and owners can create or delete trees.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UserManagement
              currentUserId={session.user.id}
              initialUsers={users as AdminUser[]}
            />
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
