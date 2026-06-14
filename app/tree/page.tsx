import type { Metadata } from 'next'
import Link from 'next/link'
import { TreeGallery } from '@/features/family-tree'
import { UserMenu } from '@/components/auth/UserMenu'
import { requireTreeAccess } from '@/lib/auth-server'

export const metadata: Metadata = {
  title: 'FamLine — Your Family Trees',
}

export default async function TreePage() {
  await requireTreeAccess()

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <Link href="/" className="font-heading text-lg font-bold text-foreground">
          FamLine
        </Link>
        <UserMenu />
      </header>
      <TreeGallery />
    </div>
  )
}
