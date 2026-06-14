'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogOut, Shield } from 'lucide-react'
import { useSession, signOut } from '@/lib/auth-client'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { GLOBAL_ROLE_LABELS, isSuperAdmin, type GlobalRole } from '@/lib/permissions'

function initials(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.trim() || '?'
  const parts = source.split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

export function UserMenu() {
  const router = useRouter()
  const { data: session, isPending } = useSession()

  if (isPending) {
    return <div className="size-8 animate-pulse rounded-full bg-muted" />
  }

  if (!session) {
    return (
      <div className="flex items-center gap-2">
        <Button render={<Link href="/login" />} nativeButton={false} variant="ghost" size="sm">
          Sign in
        </Button>
        <Button render={<Link href="/signup" />} nativeButton={false} size="sm">
          Sign up
        </Button>
      </div>
    )
  }

  const { user } = session
  const role = (user.role === 'super_admin' ? 'super_admin' : 'user') as GlobalRole

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <Popover>
      <PopoverTrigger className="rounded-full outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
        <Avatar>
          {user.image ? <AvatarImage src={user.image} alt={user.name} /> : null}
          <AvatarFallback>{initials(user.name, user.email)}</AvatarFallback>
        </Avatar>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="truncate font-medium">{user.name}</span>
          <span className="truncate text-xs text-muted-foreground">
            {user.email}
          </span>
        </div>

        <Badge variant="secondary" className="w-fit">
          {GLOBAL_ROLE_LABELS[role]}
        </Badge>

        <div className="flex flex-col gap-1">
          {isSuperAdmin(role) && (
            <Button
              render={<Link href="/admin" />}
              nativeButton={false}
              variant="ghost"
              size="sm"
              className="justify-start"
            >
              <Shield className="size-4" />
              Manage users
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="justify-start"
            onClick={handleSignOut}
          >
            <LogOut className="size-4" />
            Sign out
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
