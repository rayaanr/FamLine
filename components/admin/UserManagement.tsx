'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'
import { APP_ROLES, ROLE_LABELS, type AppRole } from '@/lib/permissions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export interface AdminUser {
  id: string
  name: string
  email: string
  role?: string | null
  banned?: boolean | null
}

export function UserManagement({
  currentUserId,
  initialUsers,
}: {
  currentUserId: string
  initialUsers: AdminUser[]
}) {
  const [users, setUsers] = useState<AdminUser[]>(initialUsers)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const changeRole = async (userId: string, role: AppRole) => {
    setPendingId(userId)
    const { error } = await authClient.admin.setRole({ userId, role })
    setPendingId(null)
    if (error) {
      toast.error(error.message ?? 'Failed to update role')
      return
    }
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, role } : u)),
    )
    toast.success(`Role updated to ${ROLE_LABELS[role]}`)
  }

  const toggleBan = async (user: AdminUser) => {
    setPendingId(user.id)
    const { error } = user.banned
      ? await authClient.admin.unbanUser({ userId: user.id })
      : await authClient.admin.banUser({ userId: user.id })
    setPendingId(null)
    if (error) {
      toast.error(error.message ?? 'Failed to update ban status')
      return
    }
    setUsers((prev) =>
      prev.map((u) =>
        u.id === user.id ? { ...u, banned: !user.banned } : u,
      ),
    )
    toast.success(user.banned ? 'User unbanned' : 'User banned')
  }

  if (users.length === 0) {
    return <p className="text-sm text-muted-foreground">No users found.</p>
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>User</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => {
          const isSelf = user.id === currentUserId
          const busy = pendingId === user.id
          return (
            <TableRow key={user.id}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{user.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {user.email}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <Select
                  value={(user.role ?? 'user') as AppRole}
                  onValueChange={(value) =>
                    changeRole(user.id, value as AppRole)
                  }
                  disabled={busy || isSelf}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {APP_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {ROLE_LABELS[role]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                {user.banned ? (
                  <Badge variant="destructive">Banned</Badge>
                ) : (
                  <Badge variant="secondary">Active</Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy || isSelf}
                  onClick={() => toggleBan(user)}
                >
                  {user.banned ? 'Unban' : 'Ban'}
                </Button>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
