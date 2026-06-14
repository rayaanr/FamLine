import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Clock } from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { SignOutButton } from '@/components/auth/SignOutButton'
import { getSession } from '@/lib/auth-server'
import { canViewTree } from '@/lib/permissions'

export const metadata: Metadata = {
  title: 'Access pending — FamLine',
}

export default async function AccessPendingPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  // Already has access — no need to sit on this page.
  if (canViewTree(session.user.role)) redirect('/tree')

  return (
    <div className="flex flex-1 items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="items-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
            <Clock className="size-6 text-muted-foreground" />
          </div>
          <CardTitle>Access pending</CardTitle>
          <CardDescription>
            Your account ({session.user.email}) doesn&apos;t have tree access yet.
            Ask an owner or administrator to grant you at least Member access.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <SignOutButton />
        </CardContent>
      </Card>
    </div>
  )
}
