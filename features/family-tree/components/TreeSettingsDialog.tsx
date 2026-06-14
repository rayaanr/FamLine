'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TREE_ROLE_LABELS } from '@/lib/permissions'
import { useActiveTree, useFamilyStore } from '../hooks/useFamilyStore'
import { useTreeAccess } from '../hooks/useTreeAccess'
import { renameTree, deleteTree } from '../server/actions'
import { getTreeSettings, updateTreeSettings } from '../server/media-actions'
import type { DocumentVisibility } from '../types'
import { TreeMembersSection } from './TreeMembersSection'

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

export function TreeSettingsDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const tree = useActiveTree()
  const { role, canEdit, canManage } = useTreeAccess()
  const clearTree = useFamilyStore((s) => s.clearTree)

  const [pending, startTransition] = useTransition()
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(tree.name)
  const [clearOpen, setClearOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [docVisibility, setDocVisibility] = useState<DocumentVisibility>('editors')

  const peopleCount = Object.keys(tree.people).length

  useEffect(() => {
    if (!open || !canManage) return
    getTreeSettings(tree.id)
      .then((s) => setDocVisibility(s.documentVisibility))
      .catch(() => {})
  }, [open, canManage, tree.id])

  const changeDocVisibility = (value: DocumentVisibility) => {
    const prev = docVisibility
    setDocVisibility(value)
    startTransition(async () => {
      const { error } = await updateTreeSettings(tree.id, { documentVisibility: value })
      if (error) {
        setDocVisibility(prev)
        toast.error(error)
        return
      }
      toast.success('Document visibility updated')
    })
  }

  const startRename = () => {
    setDraft(tree.name)
    setRenaming(true)
  }

  const saveName = () => {
    const name = draft.trim()
    if (!name || name === tree.name) {
      setRenaming(false)
      return
    }
    startTransition(async () => {
      try {
        await renameTree(tree.id, name)
        router.refresh()
        setRenaming(false)
        toast.success('Tree renamed')
      } catch {
        toast.error('Failed to rename tree')
      }
    })
  }

  const handleClear = () => {
    clearTree()
    setClearOpen(false)
    toast.success('Tree cleared')
  }

  const handleDelete = () => {
    startTransition(async () => {
      try {
        await deleteTree(tree.id)
        router.push('/tree')
      } catch {
        toast.error('Failed to delete tree')
        setDeleteOpen(false)
      }
    })
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Tree settings</DialogTitle>
            <DialogDescription>
              Manage this family tree and who can access it.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="overview">
            <TabsList className="w-full">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              {canManage && <TabsTrigger value="members">Members</TabsTrigger>}
              {canEdit && <TabsTrigger value="danger">Danger zone</TabsTrigger>}
            </TabsList>

            {/* Overview */}
            <TabsContent
              value="overview"
              className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pt-2"
            >
              {renaming ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    saveName()
                  }}
                  className="flex items-center gap-1"
                >
                  <Input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setRenaming(false)
                    }}
                    placeholder="Tree name"
                    className="h-9"
                  />
                  <Button
                    type="submit"
                    size="icon-sm"
                    variant="ghost"
                    disabled={pending}
                  >
                    <Check className="size-4" />
                  </Button>
                </form>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-lg font-semibold text-foreground">
                    {tree.name}
                  </p>
                  {canManage && (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="text-muted-foreground"
                      title="Rename tree"
                      onClick={startRename}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                  )}
                </div>
              )}

              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Your role</dt>
                  <dd className="mt-0.5">
                    <Badge variant="secondary">{TREE_ROLE_LABELS[role]}</Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">People</dt>
                  <dd className="mt-0.5 font-medium text-foreground">
                    {peopleCount}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Created</dt>
                  <dd className="mt-0.5 text-foreground">
                    {fmtDate(tree.createdAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Updated</dt>
                  <dd className="mt-0.5 text-foreground">
                    {fmtDate(tree.updatedAt)}
                  </dd>
                </div>
              </dl>

              {canManage && (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Document visibility</p>
                    <p className="text-xs text-muted-foreground">
                      Who can view members&apos; documents (passports, IDs, certificates).
                    </p>
                  </div>
                  <Select
                    value={docVisibility}
                    onValueChange={(v) => changeDocVisibility(v as DocumentVisibility)}
                  >
                    <SelectTrigger className="w-36 shrink-0" disabled={pending}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="editors">Editors only</SelectItem>
                      <SelectItem value="members">All members</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </TabsContent>

            {/* Members */}
            {canManage && (
              <TabsContent
                value="members"
                className="max-h-[60vh] overflow-y-auto pt-2"
              >
                <TreeMembersSection treeId={tree.id} />
              </TabsContent>
            )}

            {/* Danger zone */}
            {canEdit && (
              <TabsContent
                value="danger"
                className="flex max-h-[60vh] flex-col gap-3 overflow-y-auto pt-2"
              >
                {peopleCount > 0 && (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Clear tree</p>
                      <p className="text-xs text-muted-foreground">
                        Remove all people but keep the tree.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setClearOpen(true)}
                      className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      Clear
                    </Button>
                  </div>
                )}
                {canManage && (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">Delete tree</p>
                      <p className="text-xs text-muted-foreground">
                        Permanently delete this tree and everyone in it.
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteOpen(true)}
                      className="shrink-0"
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </TabsContent>
            )}
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Confirms */}
      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear this tree?</AlertDialogTitle>
            <AlertDialogDescription>
              Every person and relationship in “{tree.name}” will be removed. The
              tree itself stays. This can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleClear}>
              Clear tree
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this tree?</AlertDialogTitle>
            <AlertDialogDescription>
              “{tree.name}” and everyone in it will be permanently deleted, along
              with everyone&apos;s access to it. This can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
              disabled={pending}
            >
              Delete tree
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
