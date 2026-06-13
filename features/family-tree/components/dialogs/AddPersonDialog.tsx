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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DatePicker } from '@/components/ui/date-picker'
import { useFamilyStore } from '../../hooks/useFamilyStore'
import type { Person } from '../../types'

const schema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  gender: z.enum(['male', 'female', 'other', 'unknown']),
  birthDate: z.string().optional(),
  deathDate: z.string().optional(),
  isDeceased: z.boolean(),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

const genderLabels: Record<string, string> = {
  male: 'Male',
  female: 'Female',
  other: 'Other',
  unknown: 'Unknown',
}

interface AddPersonDialogProps {
  open: boolean
  onClose: () => void
  editPerson?: Person
}

export function AddPersonDialog({ open, onClose, editPerson }: AddPersonDialogProps) {
  const addPerson = useFamilyStore((s) => s.addPerson)
  const updatePerson = useFamilyStore((s) => s.updatePerson)

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: '',
      lastName: '',
      gender: 'unknown',
      birthDate: '',
      deathDate: '',
      isDeceased: false,
      notes: '',
    },
  })

  const isDeceased = watch('isDeceased')

  useEffect(() => {
    if (editPerson) {
      reset({
        firstName: editPerson.firstName,
        lastName: editPerson.lastName,
        gender: editPerson.gender,
        birthDate: editPerson.birthDate ?? '',
        deathDate: editPerson.deathDate ?? '',
        isDeceased: editPerson.isDeceased,
        notes: editPerson.notes ?? '',
      })
    } else {
      reset({
        firstName: '',
        lastName: '',
        gender: 'unknown',
        birthDate: '',
        deathDate: '',
        isDeceased: false,
        notes: '',
      })
    }
  }, [editPerson, reset, open])

  const onSubmit = (data: FormData) => {
    if (editPerson) {
      updatePerson(editPerson.id, {
        ...data,
        birthDate: data.birthDate || undefined,
        deathDate: data.deathDate || undefined,
        notes: data.notes || undefined,
      })
    } else {
      addPerson({
        id: nanoid(),
        ...data,
        birthDate: data.birthDate || undefined,
        deathDate: data.deathDate || undefined,
        notes: data.notes || undefined,
      })
    }
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editPerson ? 'Edit Person' : 'Add Person'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                placeholder="Alice"
                {...register('firstName')}
                aria-invalid={!!errors.firstName}
              />
              {errors.firstName && (
                <p className="text-xs text-destructive">{errors.firstName.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                placeholder="Smith"
                {...register('lastName')}
                aria-invalid={!!errors.lastName}
              />
              {errors.lastName && (
                <p className="text-xs text-destructive">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Gender</Label>
            <Controller
              name="gender"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  itemToStringLabel={(v) => genderLabels[v as string] ?? v}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Birth Date</Label>
              <Controller
                name="birthDate"
                control={control}
                render={({ field }) => (
                  <DatePicker
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Birth date"
                  />
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label>
                Death Date{' '}
                {!isDeceased && (
                  <span className="text-muted-foreground font-normal">(optional)</span>
                )}
              </Label>
              <Controller
                name="deathDate"
                control={control}
                render={({ field }) => (
                  <DatePicker
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Death date"
                    disabled={!isDeceased}
                  />
                )}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="isDeceased"
              type="checkbox"
              className="h-4 w-4 rounded border-border"
              {...register('isDeceased')}
            />
            <Label htmlFor="isDeceased">Deceased</Label>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" placeholder="Optional notes..." {...register('notes')} />
          </div>

          <DialogFooter>
            <Button type="submit">{editPerson ? 'Save Changes' : 'Add Person'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
