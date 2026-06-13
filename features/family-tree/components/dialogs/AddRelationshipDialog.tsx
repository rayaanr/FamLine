'use client'

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { nanoid } from 'nanoid'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useFamilyStore } from '../../hooks/useFamilyStore'

// ─── Couple schema ─────────────────────────────────────────────────────────────
const coupleSchema = z
  .object({
    partner1Id: z.string().min(1, 'Select a person'),
    partner2Id: z.string().min(1, 'Select a person'),
    status: z.enum(['married', 'divorced', 'separated', 'partnered']),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  })
  .refine((d) => d.partner1Id !== d.partner2Id, {
    message: 'A person cannot be their own partner',
    path: ['partner2Id'],
  })

type CoupleFormData = z.infer<typeof coupleSchema>

// ─── ParentChild schema ────────────────────────────────────────────────────────
const parentChildSchema = z
  .object({
    childId: z.string().min(1, 'Select a child'),
    parentType: z.enum(['couple', 'single']),
    coupleId: z.string().optional(),
    singleParentId: z.string().optional(),
    type: z.enum(['biological', 'adopted', 'step']),
  })
  .refine(
    (d) =>
      (d.parentType === 'couple' && !!d.coupleId) ||
      (d.parentType === 'single' && !!d.singleParentId),
    { message: 'Select a parent', path: ['coupleId'] }
  )

type ParentChildFormData = z.infer<typeof parentChildSchema>

// ─── Props ─────────────────────────────────────────────────────────────────────
interface AddRelationshipDialogProps {
  open: boolean
  onClose: () => void
  mode: 'couple' | 'parentChild'
  // Couple mode: pre-fill one of the partner slots
  preselectedPartnerId?: string
  // ParentChild mode: pre-fill the parent slot (person clicked "Add Child")
  preselectedParentId?: string
  // ParentChild mode: pre-fill the child slot (person clicked "Add Parent")
  preselectedChildId?: string
}

// ─── Couple form ───────────────────────────────────────────────────────────────
function CoupleForm({
  onClose,
  preselectedPartnerId,
}: {
  onClose: () => void
  preselectedPartnerId?: string
}) {
  const people = useFamilyStore((s) => s.people)
  const addCouple = useFamilyStore((s) => s.addCouple)

  const { handleSubmit, control, reset, register, formState: { errors } } =
    useForm<CoupleFormData>({
      resolver: zodResolver(coupleSchema),
      defaultValues: {
        partner1Id: preselectedPartnerId ?? '',
        partner2Id: '',
        status: 'married',
        startDate: '',
        endDate: '',
      },
    })

  useEffect(() => {
    reset({
      partner1Id: preselectedPartnerId ?? '',
      partner2Id: '',
      status: 'married',
      startDate: '',
      endDate: '',
    })
  }, [preselectedPartnerId, reset])

  const onSubmit = (data: CoupleFormData) => {
    addCouple({
      id: nanoid(),
      partner1Id: data.partner1Id,
      partner2Id: data.partner2Id,
      status: data.status,
      startDate: data.startDate || undefined,
      endDate: data.endDate || undefined,
    })
    onClose()
  }

  const personOptions = Object.values(people)

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Person 1</Label>
        <Controller
          name="partner1Id"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select person..." />
              </SelectTrigger>
              <SelectContent>
                {personOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.firstName} {p.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.partner1Id && (
          <p className="text-xs text-destructive">{errors.partner1Id.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>Person 2</Label>
        <Controller
          name="partner2Id"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select person..." />
              </SelectTrigger>
              <SelectContent>
                {personOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.firstName} {p.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.partner2Id && (
          <p className="text-xs text-destructive">{errors.partner2Id.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>Relationship Status</Label>
        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="married">Married</SelectItem>
                <SelectItem value="partnered">Partnered</SelectItem>
                <SelectItem value="divorced">Divorced</SelectItem>
                <SelectItem value="separated">Separated</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="startDate">Start Date</Label>
          <Input id="startDate" type="date" {...register('startDate')} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="endDate">End Date</Label>
          <Input id="endDate" type="date" {...register('endDate')} />
        </div>
      </div>

      <DialogFooter>
        <Button type="submit">Add Relationship</Button>
      </DialogFooter>
    </form>
  )
}

// ─── ParentChild form ──────────────────────────────────────────────────────────
function ParentChildForm({
  onClose,
  preselectedParentId,
  preselectedChildId,
}: {
  onClose: () => void
  preselectedParentId?: string
  preselectedChildId?: string
}) {
  const people = useFamilyStore((s) => s.people)
  const couples = useFamilyStore((s) => s.couples)
  const parentChildren = useFamilyStore((s) => s.parentChildren)
  const addParentChild = useFamilyStore((s) => s.addParentChild)

  const { handleSubmit, control, watch, reset, setError, formState: { errors } } =
    useForm<ParentChildFormData>({
      resolver: zodResolver(parentChildSchema),
      defaultValues: {
        childId: preselectedChildId ?? '',
        parentType: 'couple',
        coupleId: '',
        singleParentId: preselectedParentId ?? '',
        type: 'biological',
      },
    })

  useEffect(() => {
    reset({
      childId: preselectedChildId ?? '',
      parentType: preselectedParentId ? 'single' : 'couple',
      coupleId: '',
      singleParentId: preselectedParentId ?? '',
      type: 'biological',
    })
  }, [preselectedParentId, preselectedChildId, reset])

  const parentType = watch('parentType')

  const onSubmit = (data: ParentChildFormData) => {
    if (data.type === 'biological') {
      const existingBioParents = Object.values(parentChildren).filter(
        (pc) => pc.childId === data.childId && pc.type === 'biological'
      )
      if (existingBioParents.length >= 2) {
        setError('type', { message: 'A child can have at most 2 biological parents' })
        return
      }
    }

    addParentChild({
      id: nanoid(),
      childId: data.childId,
      coupleId: data.parentType === 'couple' ? data.coupleId : undefined,
      singleParentId: data.parentType === 'single' ? data.singleParentId : undefined,
      type: data.type,
    })
    onClose()
  }

  const personOptions = Object.values(people)
  const coupleOptions = Object.values(couples)

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Child</Label>
        <Controller
          name="childId"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select child..." />
              </SelectTrigger>
              <SelectContent>
                {personOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.firstName} {p.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.childId && (
          <p className="text-xs text-destructive">{errors.childId.message}</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>Parent Type</Label>
        <Controller
          name="parentType"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="couple">Couple (two parents)</SelectItem>
                <SelectItem value="single">Single parent</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {parentType === 'couple' && (
        <div className="space-y-1.5">
          <Label>Parent Couple</Label>
          <Controller
            name="coupleId"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select couple..." />
                </SelectTrigger>
                <SelectContent>
                  {coupleOptions.map((c) => {
                    const p1 = people[c.partner1Id]
                    const p2 = people[c.partner2Id]
                    return (
                      <SelectItem key={c.id} value={c.id}>
                        {p1 ? `${p1.firstName} ${p1.lastName}` : 'Unknown'} &{' '}
                        {p2 ? `${p2.firstName} ${p2.lastName}` : 'Unknown'}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            )}
          />
          {errors.coupleId && (
            <p className="text-xs text-destructive">{errors.coupleId.message}</p>
          )}
        </div>
      )}

      {parentType === 'single' && (
        <div className="space-y-1.5">
          <Label>Parent</Label>
          <Controller
            name="singleParentId"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select parent..." />
                </SelectTrigger>
                <SelectContent>
                  {personOptions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.firstName} {p.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      )}

      <div className="space-y-1.5">
        <Label>Relationship Type</Label>
        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="biological">Biological</SelectItem>
                <SelectItem value="adopted">Adopted</SelectItem>
                <SelectItem value="step">Step</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
        {errors.type && (
          <p className="text-xs text-destructive">{errors.type.message}</p>
        )}
      </div>

      <DialogFooter>
        <Button type="submit">Add Relationship</Button>
      </DialogFooter>
    </form>
  )
}

// ─── Main dialog ───────────────────────────────────────────────────────────────
export function AddRelationshipDialog({
  open,
  onClose,
  mode,
  preselectedPartnerId,
  preselectedParentId,
  preselectedChildId,
}: AddRelationshipDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'couple' ? 'Add Partner Relationship' : 'Add Parent-Child Relationship'}
          </DialogTitle>
        </DialogHeader>

        {mode === 'couple' ? (
          <CoupleForm onClose={onClose} preselectedPartnerId={preselectedPartnerId} />
        ) : (
          <ParentChildForm
            onClose={onClose}
            preselectedParentId={preselectedParentId}
            preselectedChildId={preselectedChildId}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
