'use client'

import { useEffect, useState, useTransition } from 'react'
import { Trash2, Copy, Check, Clock } from 'lucide-react'
import { toast } from 'sonner'
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
  inviteMember,
  updateMemberRole,
  removeMember,
  listInvitations,
  revokeInvitation,
  type MemberInfo,
  type InvitationInfo,
} from '../server/actions'

/** Owner-only member management. Renders inside the tree settings sheet. */
export function TreeMembersSection({ treeId }: { treeId: string }) {
  const [members, setMembers] = useState<MemberInfo[] | null>(null)
  const [invitations, setInvitations] = useState<InvitationInfo[]>([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<TreeRole>('member')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const refresh = async () => {
    try {
      const [m, i] = await Promise.all([listMembers(treeId), listInvitations(treeId)])
      setMembers(m)
      setInvitations(i)
    } catch {
      toast.error('Failed to load members')
    }
  }

  useEffect(() => {
    let cancelled = false
    Promise.all([listMembers(treeId), listInvitations(treeId)])
      .then(([m, i]) => {
        if (!cancelled) {
          setMembers(m)
          setInvitations(i)
        }
      })
      .catch(() => toast.error('Failed to load members'))
    return () => {
      cancelled = true
    }
  }, [treeId])

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return
    startTransition(async () => {
      const res = await inviteMember(treeId, trimmed, role)
      if (res.error) {
        toast.error(res.error)
        return
      }
      setEmail('')
      if (res.added) {
        toast.success('Member added')
        await refresh()
        return
      }
      if (res.inviteUrl) {
        await navigator.clipboard.writeText(res.inviteUrl)
        toast.success('Invite link copied to clipboard — share it with them')
        await refresh()
      }
    })
  }

  const copyInviteLink = (inv: InvitationInfo) =>
    // Re-fetch the token via a fresh invite (reuses existing token server-side)
    startTransition(async () => {
      const res = await inviteMember(treeId, inv.email, inv.role as TreeRole)
      if (res.inviteUrl) {
        await navigator.clipboard.writeText(res.inviteUrl)
        setCopiedId(inv.id)
        setTimeout(() => setCopiedId(null), 2000)
      }
    })

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

  const handleRevoke = (invitationId: string) =>
    startTransition(async () => {
      try {
        await revokeInvitation(invitationId)
        await refresh()
      } catch {
        toast.error('Failed to revoke invitation')
      }
    })

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleInvite} className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="member-email">Invite by email</Label>
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
            {TREE_ROLES.filter((r) => r !== 'owner').map((r) => (
              <SelectItem key={r} value={r}>
                {TREE_ROLE_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" disabled={pending || !email.trim()}>
          Invite
        </Button>
      </form>

      <div className="flex flex-col gap-1">
        {members === null ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Loading…</p>
        ) : (
          members.map((m) => (
            <div
              key={m.userId}
              className="flex items-center justify-between gap-2 rounded-lg px-1 py-1.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{m.name}</p>
                <p className="truncate text-xs text-muted-foreground">{m.email}</p>
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

      {invitations.length > 0 && (
        <div className="flex flex-col gap-1 border-t pt-3">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Pending invites</p>
          {invitations.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center justify-between gap-2 rounded-lg px-1 py-1.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm">{inv.email}</p>
                <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                  <Clock className="size-3" />
                  Expires {new Date(inv.expiresAt).toLocaleDateString()}
                  {' · '}
                  {TREE_ROLE_LABELS[inv.role as TreeRole]}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={pending}
                  onClick={() => copyInviteLink(inv)}
                  title="Copy invite link"
                  className="text-muted-foreground hover:text-foreground"
                >
                  {copiedId === inv.id ? (
                    <Check className="size-3.5" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={pending}
                  onClick={() => handleRevoke(inv.id)}
                  title="Revoke invitation"
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
