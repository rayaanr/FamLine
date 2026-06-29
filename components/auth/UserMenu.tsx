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
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
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
        <Button render={<Link href="/login" />} nativeButton={false} variant="secondary">
          Sign in
        </Button>
        <Button render={<Link href="/signup" />} nativeButton={false}>
          Sign up
        </Button>
      </div>
    )
  }

  const { user } = session
  const role = (user.role === 'super_admin' ? 'super_admin' : 'user') as GlobalRole
  const isAdmin = isSuperAdmin(role)

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <Popover>
      <PopoverTrigger className="rounded-full outline-hidden focus-visible:ring-2 focus-visible:ring-ring">
        <Avatar>
          {user.image ? <AvatarImage src={user.image} alt={user.name ?? ''} /> : null}
          <AvatarFallback>{initials(user.name, user.email)}</AvatarFallback>
        </Avatar>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-56 overflow-hidden p-0">
        {/* User info */}
        <div className="flex items-center gap-2.5 px-3 py-3">
          <Avatar className="size-9 shrink-0">
            {user.image ? <AvatarImage src={user.image} alt={user.name ?? ''} /> : null}
            <AvatarFallback className="text-xs">{initials(user.name, user.email)}</AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-sm font-semibold leading-tight">{user.name}</span>
            <span className="truncate text-xs text-muted-foreground leading-tight">{user.email}</span>
          </div>
        </div>

        <div className="px-3 pb-2.5">
          <Badge
            variant="outline"
            className={cn(
              'text-[11px] font-medium',
              isAdmin
                ? 'border-violet-300 bg-violet-50 text-violet-700 dark:border-violet-700/50 dark:bg-violet-950/30 dark:text-violet-400'
                : 'text-muted-foreground',
            )}
          >
            {isAdmin && <Shield className="size-2.5!" />}
            {GLOBAL_ROLE_LABELS[role]}
          </Badge>
        </div>

        <Separator />

        {/* Actions */}
        <div className="p-1">
          {isAdmin && (
            <Button
              render={<Link href="/admin" />}
              nativeButton={false}
              variant="ghost"
              size="sm"
              className="w-full justify-start"
            >
              <Shield className="size-4" />
              Manage users
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
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
