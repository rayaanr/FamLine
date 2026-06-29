'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { acceptInvitation } from '@/features/family-tree/server/actions'

export function AcceptInviteForm({
  token,
  treeName,
}: {
  token: string
  treeName: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const handleAccept = () =>
    startTransition(async () => {
      const res = await acceptInvitation(token)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success(`You've joined ${treeName}`)
      router.push(`/tree/${res.treeId}`)
    })

  return (
    <Button onClick={handleAccept} disabled={pending} className="w-full">
      {pending ? 'Joining…' : `Join ${treeName}`}
    </Button>
  )
}
