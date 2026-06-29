import { redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { eq, and, isNull, gt } from 'drizzle-orm'
import { db } from '@/db'
import { treeInvitation, trees } from '@/db/schema'
import { getSession } from '@/lib/auth-server'
import { TREE_ROLE_LABELS, type TreeRole } from '@/lib/permissions'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AcceptInviteForm } from './_AcceptInviteForm'

export const metadata: Metadata = { title: 'Join family tree - FamLine' }

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  if (!token) redirect('/tree')

  const session = await getSession()
  if (!session) {
    redirect(`/login?redirect=/join?token=${encodeURIComponent(token)}`)
  }

  const [inv] = await db
    .select({
      id: treeInvitation.id,
      email: treeInvitation.email,
      role: treeInvitation.role,
      expiresAt: treeInvitation.expiresAt,
      acceptedAt: treeInvitation.acceptedAt,
      treeName: trees.name,
      treeId: treeInvitation.treeId,
    })
    .from(treeInvitation)
    .innerJoin(trees, eq(trees.id, treeInvitation.treeId))
    .where(eq(treeInvitation.token, token))
    .limit(1)

  const errorMessage = !inv
    ? 'This invite link is invalid.'
    : inv.acceptedAt
      ? 'This invite link has already been used.'
      : inv.expiresAt < new Date()
        ? 'This invite link has expired.'
        : null

  const wrongEmail =
    inv && !errorMessage && inv.email !== session.user.email
      ? `This invite is for ${inv.email}. You're signed in as ${session.user.email}.`
      : null

  return (
    <div className="flex flex-1 items-center justify-center bg-background p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <Link href="/" className="flex flex-col items-center gap-2">
            <Image src="/Logo.svg" alt="FamLine" width={40} height={57} />
            <span className="font-heading text-2xl font-bold">FamLine</span>
          </Link>
          <CardTitle>Family tree invitation</CardTitle>
          {inv && !errorMessage && !wrongEmail && (
            <CardDescription>
              You&apos;ve been invited to join{' '}
              <span className="font-medium text-foreground">{inv.treeName}</span> as{' '}
              {TREE_ROLE_LABELS[inv.role as TreeRole]}.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {errorMessage || wrongEmail ? (
            <p className="text-center text-sm text-muted-foreground">
              {errorMessage ?? wrongEmail}
            </p>
          ) : inv ? (
            <AcceptInviteForm token={token} treeName={inv.treeName} />
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
