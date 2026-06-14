import type { Metadata } from 'next'
import { TreeView } from '@/features/family-tree'
import { requireTreeAccess } from '@/lib/auth-server'

export const metadata: Metadata = {
  title: 'FamLine — Family Tree',
}

export default async function TreeByIdPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireTreeAccess()
  const { id } = await params
  return (
    <div className="h-screen w-screen overflow-hidden">
      <TreeView treeId={id} />
    </div>
  )
}
