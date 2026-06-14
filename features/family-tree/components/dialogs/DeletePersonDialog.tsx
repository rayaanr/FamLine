'use client'

import { useMemo } from 'react'
import { UserMinus, TreeDeciduous, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useFamilyStore, useActiveTree } from '../../hooks/useFamilyStore'
import { getDescendantIds } from '../../utils/relations'
import { personDisplayName } from '../../utils/person'

interface DeletePersonDialogProps {
  open: boolean
  personId: string | null
  onClose: () => void
  onDeleted: () => void
}

export function DeletePersonDialog({ open, personId, onClose, onDeleted }: DeletePersonDialogProps) {
  const tree = useActiveTree()
  const removePerson = useFamilyStore((s) => s.removePerson)
  const removePeople = useFamilyStore((s) => s.removePeople)
  const convertToPlaceholder = useFamilyStore((s) => s.convertToPlaceholder)

  const person = personId ? tree.people[personId] : undefined

  const descendantIds = useMemo(
    () => (personId ? getDescendantIds(tree, personId) : new Set<string>()),
    [tree, personId]
  )
  const descendantCount = descendantIds.size
  const hasDescendants = descendantCount > 0

  if (!person) return null

  const name = personDisplayName(person)

  // "Profile only": if relatives hang below this person, keep the node as an
  // Unknown placeholder so they stay connected; otherwise just remove it.
  const deleteProfileOnly = () => {
    if (hasDescendants) convertToPlaceholder(person.id)
    else removePerson(person.id)
    onDeleted()
  }

  const deleteBranch = () => {
    removePeople([person.id, ...descendantIds])
    onDeleted()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete {name}?</DialogTitle>
          <DialogDescription>
            {hasDescendants
              ? `${name} has ${descendantCount} relative${descendantCount === 1 ? '' : 's'} below them. Choose what to remove.`
              : `This will permanently remove ${name} from the tree.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <button
            onClick={deleteProfileOnly}
            className="flex items-start gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted"
          >
            <UserMinus className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                {hasDescendants ? 'Delete profile only' : 'Delete person'}
              </p>
              <p className="text-xs text-muted-foreground">
                {hasDescendants
                  ? 'Replace them with an “Unknown” placeholder and keep everyone below linked.'
                  : 'Remove this person from the tree.'}
              </p>
            </div>
          </button>

          {hasDescendants && (
            <button
              onClick={deleteBranch}
              className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-left transition-colors hover:bg-destructive/10"
            >
              <TreeDeciduous className="mt-0.5 size-4 shrink-0 text-destructive" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-destructive">
                  Delete {name} and everyone below
                </p>
                <p className="text-xs text-muted-foreground">
                  Removes {name} and all {descendantCount} descendant
                  {descendantCount === 1 ? '' : 's'}. This can&apos;t be undone.
                </p>
              </div>
            </button>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {!hasDescendants && (
            <Button variant="destructive" onClick={deleteProfileOnly}>
              <Trash2 />
              Delete
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
