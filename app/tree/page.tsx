import type { Metadata } from 'next'
import { TreeGallery } from '@/features/family-tree'

export const metadata: Metadata = {
  title: 'FamLine — Your Family Trees',
}

export default function TreePage() {
  return (
    <div className="min-h-screen bg-background">
      <TreeGallery />
    </div>
  )
}
