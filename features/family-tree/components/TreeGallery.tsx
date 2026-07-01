'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, FlaskConical, Pencil, Plus, TreePine, Trash2, Users } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TREE_ROLE_LABELS } from '@/lib/permissions'
import type { TreeSummary } from '@/lib/tree-access'
import { createDemoTree, deleteTree, renameTree } from '../server/actions'
import { NewTreeDialog } from './dialogs/NewTreeDialog'

export function TreeGallery({
  initialTrees,
  canLoadDemo = false,
}: {
  initialTrees: TreeSummary[]
  canLoadDemo?: boolean
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [newOpen, setNewOpen] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const commitRename = () => {
    const id = renamingId
    const name = draft.trim()
    setRenamingId(null)
    setDraft('')
    if (!id || !name) return
    startTransition(async () => {
      try {
        await renameTree(id, name)
        router.refresh()
      } catch {
        toast.error('Failed to rename tree')
      }
    })
  }

  const handleLoadDemo = () => {
    startTransition(async () => {
      try {
        const slug = await createDemoTree()
        router.push(`/tree/${slug}`)
      } catch {
        toast.error('Failed to create demo tree')
      }
    })
  }

  const handleDelete = (tree: TreeSummary) => {
    if (
      !window.confirm(
        `Delete "${tree.name}"? This permanently removes everyone in it.`,
      )
    )
      return
    startTransition(async () => {
      try {
        await deleteTree(tree.id)
        router.refresh()
        toast.success('Tree deleted')
      } catch {
        toast.error('Failed to delete tree')
      }
    })
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <header className="mb-8 flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Your family trees
          </h1>
          <p className="text-sm text-muted-foreground">
            {initialTrees.length}{' '}
            {initialTrees.length === 1 ? 'tree' : 'trees'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canLoadDemo && (
            <Button
              variant="outline"
              onClick={handleLoadDemo}
              className="gap-1.5"
              title="Create a tree pre-filled with demo data"
            >
              <FlaskConical className="size-4" />
              Load demo
            </Button>
          )}
          <Button onClick={() => setNewOpen(true)} className="gap-1.5">
            <Plus className="size-4" />
            New tree
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {initialTrees.map((tree) => {
          const updated = new Date(tree.updatedAt).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })

          return (
            <div
              key={tree.id}
              className="group relative flex flex-col gap-4 rounded-xl border border-border bg-card p-5 transition-colors hover:border-foreground/20 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <TreePine className="size-5" />
                </div>
                {tree.role === 'owner' && (
                  <div className="relative z-10 flex items-center opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="size-7 text-muted-foreground"
                      title="Rename"
                      onClick={() => {
                        setRenamingId(tree.id)
                        setDraft(tree.name)
                      }}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      className="size-7 text-muted-foreground hover:text-destructive"
                      title="Delete tree"
                      onClick={() => handleDelete(tree)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              {renamingId === tree.id ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    commitRename()
                  }}
                  className="relative z-10 flex items-center gap-1"
                >
                  <Input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setRenamingId(null)
                        setDraft('')
                      }
                    }}
                    placeholder="Tree name"
                    className="h-8"
                  />
                  <Button type="submit" size="icon-sm" variant="ghost">
                    <Check className="size-4" />
                  </Button>
                </form>
              ) : (
                <Link href={`/tree/${tree.slug}`} className="flex flex-col gap-1">
                  <span className="flex items-center gap-2 truncate text-base font-semibold text-foreground">
                    {tree.name}
                    {tree.role !== 'owner' && (
                      <Badge variant="secondary" className="shrink-0">
                        {TREE_ROLE_LABELS[tree.role]}
                      </Badge>
                    )}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="size-3.5" />
                    {tree.peopleCount}{' '}
                    {tree.peopleCount === 1 ? 'person' : 'people'}
                    <span aria-hidden>·</span>
                    Updated {updated}
                  </span>
                </Link>
              )}

              {renamingId !== tree.id && (
                <Link
                  href={`/tree/${tree.slug}`}
                  className="absolute inset-0 rounded-xl"
                  aria-label={`Open ${tree.name}`}
                />
              )}
            </div>
          )
        })}

        <button
          type="button"
          onClick={() => setNewOpen(true)}
          className="flex min-h-34 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
        >
          <Plus className="size-6" />
          <span className="text-sm font-medium">New family tree</span>
        </button>
      </div>

      <NewTreeDialog open={newOpen} onClose={() => setNewOpen(false)} />
    </div>
  )
}
