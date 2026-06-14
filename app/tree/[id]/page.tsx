import type { Metadata } from 'next'
import { TreeView } from '@/features/family-tree'
import { requireTreeView, toNamedTree } from '@/lib/tree-access'

export const metadata: Metadata = {
  title: 'FamLine — Family Tree',
}

export default async function TreeByIdPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { tree, role } = await requireTreeView(id)

  return (
    <div className="h-screen w-screen overflow-hidden">
      <TreeView tree={toNamedTree(tree)} role={role} />
    </div>
  )
}
