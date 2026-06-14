'use client'

import { useEffect, useState, useTransition } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TREE_ROLES, TREE_ROLE_LABELS, type TreeRole } from '@/lib/permissions'
import {
  listMembers,
  addMember,
  updateMemberRole,
  removeMember,
  type MemberInfo,
} from '../../server/actions'

interface MembersDialogProps {
  treeId: string
  open: boolean
  onClose: () => void
}

export function MembersDialog({ treeId, open, onClose }: MembersDialogProps) {
  const [members, setMembers] = useState<MemberInfo[] | null>(null)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<TreeRole>('member')
  const [pending, startTransition] = useTransition()

  // Reload the member list. Called from event handlers and after the dialog
  // opens — setState always lands in an async callback, never synchronously.
  const refresh = async () => {
    try {
      setMembers(await listMembers(treeId))
    } catch {
      toast.error('Failed to load members')
    }
  }

  useEffect(() => {
    if (!open) return
    let cancelled = false
    listMembers(treeId)
      .then((m) => {
        if (!cancelled) setMembers(m)
      })
      .catch(() => toast.error('Failed to load members'))
    return () => {
      cancelled = true
    }
  }, [open, treeId])

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return
    startTransition(async () => {
      const res = await addMember(treeId, trimmed, role)
      if (res.error) {
        toast.error(res.error)
        return
      }
      setEmail('')
      toast.success('Member added')
      await refresh()
    })
  }

  const handleRole = (userId: string, newRole: TreeRole) =>
    startTransition(async () => {
      const res = await updateMemberRole(treeId, userId, newRole)
      if (res.error) {
        toast.error(res.error)
        return
      }
      await refresh()
    })

  const handleRemove = (userId: string) =>
    startTransition(async () => {
      try {
        await removeMember(treeId, userId)
        await refresh()
      } catch {
        toast.error('Failed to remove member')
      }
    })

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Members</DialogTitle>
          <DialogDescription>
            People who can access this tree. Members can view, editors can edit,
            owners can manage everything.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleAdd} className="flex items-end gap-2">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="member-email">Add by email</Label>
            <Input
              id="member-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
            />
          </div>
          <Select value={role} onValueChange={(v) => setRole(v as TreeRole)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TREE_ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {TREE_ROLE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" disabled={pending || !email.trim()}>
            Add
          </Button>
        </form>

        <div className="flex flex-col gap-1">
          {members === null ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Loading…
            </p>
          ) : (
            members.map((m) => (
              <div
                key={m.userId}
                className="flex items-center justify-between gap-2 rounded-lg px-1 py-1.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{m.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {m.email}
                  </p>
                </div>
                {m.isOwner ? (
                  <Badge variant="secondary">Owner</Badge>
                ) : (
                  <div className="flex items-center gap-1">
                    <Select
                      value={m.role}
                      onValueChange={(v) => handleRole(m.userId, v as TreeRole)}
                      disabled={pending}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TREE_ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {TREE_ROLE_LABELS[r]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={pending}
                      onClick={() => handleRemove(m.userId)}
                      title="Remove member"
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
