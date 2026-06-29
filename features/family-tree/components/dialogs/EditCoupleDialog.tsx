'use client'

import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
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
import { useFamilyStore, useActiveTree } from '../../hooks/useFamilyStore'

const schema = z.object({
  status: z.enum(['married', 'divorced', 'separated', 'partnered']),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface EditCoupleDialogProps {
  coupleId: string | null
  onClose: () => void
}

export function EditCoupleDialog({ coupleId, onClose }: EditCoupleDialogProps) {
  const { couples, people } = useActiveTree()
  const updateCouple = useFamilyStore((s) => s.updateCouple)

  const couple = coupleId ? couples[coupleId] : null

  const { handleSubmit, control, watch, reset } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: 'married', startDate: '', endDate: '' },
  })

  useEffect(() => {
    if (couple) {
      reset({
        status: couple.status,
        startDate: couple.startDate ?? '',
        endDate: couple.endDate ?? '',
      })
    }
  }, [couple, reset])

  const status = watch('status')

  const onSubmit = (data: FormData) => {
    if (!coupleId) return
    updateCouple(coupleId, {
      status: data.status,
      startDate: data.startDate || undefined,
      endDate: data.status === 'divorced' ? (data.endDate || undefined) : undefined,
    })
    onClose()
  }

  if (!couple) return null

  const p1 = people[couple.partner1Id]
  const p2 = people[couple.partner2Id]
  const title = `${p1 ? `${p1.firstName} ${p1.lastName}` : '?'} & ${p2 ? `${p2.firstName} ${p2.lastName}` : '?'}`

  return (
    <Dialog open={!!coupleId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

          <div className={`grid gap-3 ${status === 'divorced' ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <div className="space-y-1.5">
              <Label>Marriage Date</Label>
              <Controller
                name="startDate"
                control={control}
                render={({ field }) => (
                  <DatePicker
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Marriage date"
                  />
                )}
              />
            </div>
            {status === 'divorced' && (
              <div className="space-y-1.5">
                <Label>Divorce Date</Label>
                <Controller
                  name="endDate"
                  control={control}
                  render={({ field }) => (
                    <DatePicker
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Divorce date"
                    />
                  )}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
