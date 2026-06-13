'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Pencil, Plus, TreePine, Trash2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useFamilyStore } from '../hooks/useFamilyStore'
import { useHydration } from '../hooks/useHydration'
import { NewTreeDialog } from './dialogs/NewTreeDialog'

export function TreeGallery() {
  const hydrated = useHydration()
  const trees = useFamilyStore((s) => s.trees)
  const renameTree = useFamilyStore((s) => s.renameTree)
  const deleteTree = useFamilyStore((s) => s.deleteTree)

  const [newOpen, setNewOpen] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  const treeList = Object.values(trees).sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt)
  )
  const canDelete = treeList.length > 1

  const commitRename = () => {
    if (renamingId) renameTree(renamingId, draft)
    setRenamingId(null)
    setDraft('')
  }

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <header className="mb-8 flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Your family trees
          </h1>
          <p className="text-sm text-muted-foreground">
            {treeList.length} {treeList.length === 1 ? 'tree' : 'trees'}
          </p>
        </div>
        <Button onClick={() => setNewOpen(true)} className="gap-1.5">
          <Plus className="size-4" />
          New tree
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {treeList.map((tree) => {
          const peopleCount = Object.keys(tree.people).length
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
                    title={canDelete ? 'Delete tree' : 'Cannot delete the last tree'}
                    disabled={!canDelete}
                    onClick={() => {
                      if (
                        window.confirm(
                          `Delete "${tree.name}"? This permanently removes everyone in it.`
                        )
                      ) {
                        deleteTree(tree.id)
                      }
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
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
                <Link href={`/tree/${tree.id}`} className="flex flex-col gap-1">
                  <span className="truncate text-base font-semibold text-foreground">
                    {tree.name}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="size-3.5" />
                    {peopleCount} {peopleCount === 1 ? 'person' : 'people'}
                    <span aria-hidden>·</span>
                    Updated {updated}
                  </span>
                </Link>
              )}

              {renamingId !== tree.id && (
                <Link
                  href={`/tree/${tree.id}`}
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
          className="flex min-h-[8.5rem] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
        >
          <Plus className="size-6" />
          <span className="text-sm font-medium">New family tree</span>
        </button>
      </div>

      <NewTreeDialog open={newOpen} onClose={() => setNewOpen(false)} />
    </div>
  )
}
