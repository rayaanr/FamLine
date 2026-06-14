'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { signOut } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'

export function SignOutButton({
  variant = 'outline',
  className,
}: {
  variant?: 'outline' | 'ghost' | 'default'
  className?: string
}) {
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <Button variant={variant} className={className} onClick={handleSignOut}>
      <LogOut className="size-4" />
      Sign out
    </Button>
  )
}
