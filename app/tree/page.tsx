import type { Metadata } from 'next'
import { FamilyTreeCanvas } from '@/features/family-tree'

export const metadata: Metadata = {
  title: 'FamLine — Family Tree',
}

export default function TreePage() {
  return (
    <div className="h-screen w-screen overflow-hidden">
      <FamilyTreeCanvas />
    </div>
  )
}
