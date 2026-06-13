'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useFamilyStore } from '../../hooks/useFamilyStore'

interface NewTreeDialogProps {
  open: boolean
  onClose: () => void
}

export function NewTreeDialog({ open, onClose }: NewTreeDialogProps) {
  const router = useRouter()
  const createTree = useFamilyStore((s) => s.createTree)
  const [name, setName] = useState('')

  const trimmed = name.trim()

  const close = () => {
    setName('')
    onClose()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!trimmed) return
    const id = createTree(trimmed)
    close()
    router.push(`/tree/${id}`)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>New family tree</DialogTitle>
            <DialogDescription>
              Give your family tree a name. You can rename it later.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2">
            <Label htmlFor="tree-name">Name</Label>
            <Input
              id="tree-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. The Smiths"
            />
          </div>

          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancel
            </DialogClose>
            <Button type="submit" disabled={!trimmed}>
              Create tree
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
