import type { Metadata } from 'next'
import { TreeView } from '@/features/family-tree'

export const metadata: Metadata = {
  title: 'FamLine — Family Tree',
}

export default async function TreeByIdPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <div className="h-screen w-screen overflow-hidden">
      <TreeView treeId={id} />
    </div>
  )
}
