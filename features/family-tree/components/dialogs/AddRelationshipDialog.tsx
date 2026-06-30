'use client'

import { useEffect, type ReactNode } from 'react'
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
import { DatePicker } from '@/components/ui/date-picker'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useFamilyStore, useActiveTree } from '../../hooks/useFamilyStore'

// ─── Label maps ────────────────────────────────────────────────────────────────
const statusLabels: Record<string, string> = {
  married: 'Married',
  partnered: 'Partnered',
  divorced: 'Divorced',
  separated: 'Separated',
}

const parentTypeLabels: Record<string, string> = {
  couple: 'Couple (two parents)',
  single: 'Single parent',
}

const relationshipTypeLabels: Record<string, string> = {
  biological: 'Biological',
  adopted: 'Adopted',
  step: 'Step',
}

// ─── Person mode tabs (New person / Existing person) ──────────────────────────
function PersonModeTabs({
  value,
  onValueChange,
  children,
}: {
  value: string
  onValueChange: (v: string) => void
  children: ReactNode
}) {
  return (
    <Tabs value={value} onValueChange={onValueChange}>
      <TabsList className="w-full">
        <TabsTrigger value="new" className="flex-1">New person</TabsTrigger>
        <TabsTrigger value="existing" className="flex-1">Existing person</TabsTrigger>
      </TabsList>
      {children}
    </Tabs>
  )
}

// ─── Schemas ───────────────────────────────────────────────────────────────────
const coupleSchema = z
  .object({
    partner2Mode: z.enum(['new', 'existing']),
    // existing mode
    partner2Id: z.string().optional(),
    // new mode
    partner2FirstName: z.string().optional(),
    partner2LastName: z.string().optional(),
    partner2Gender: z.enum(['male', 'female', 'other', 'unknown']),
    status: z.enum(['married', 'divorced', 'separated', 'partnered']),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  })
  .refine(
    (d) => d.partner2Mode === 'new' || !!d.partner2Id,
    { message: 'Select a person', path: ['partner2Id'] },
  )

type CoupleFormData = z.infer<typeof coupleSchema>

const parentChildSchema = z
  .object({
    childMode: z.enum(['new', 'existing']),
    childId: z.string().optional(),
    childFirstName: z.string().optional(),
    childLastName: z.string().optional(),
    childGender: z.enum(['male', 'female', 'other', 'unknown']),
    parentType: z.enum(['couple', 'single']),
    coupleId: z.string().optional(),
    singleParentMode: z.enum(['new', 'existing']),
    singleParentId: z.string().optional(),
    singleParentFirstName: z.string().optional(),
    singleParentLastName: z.string().optional(),
    singleParentGender: z.enum(['male', 'female', 'other', 'unknown']),
    type: z.enum(['biological', 'adopted', 'step']),
  })
  .refine(
    (d) => d.childMode === 'new' || !!d.childId,
    { message: 'Select a child', path: ['childId'] },
  )
  .refine(
    (d) => {
      if (d.parentType === 'couple') return !!d.coupleId
      if (d.parentType === 'single' && d.singleParentMode === 'existing')
        return !!d.singleParentId
      return true
    },
    { message: 'Select a parent', path: ['coupleId'] },
  )

type ParentChildFormData = z.infer<typeof parentChildSchema>

// ─── Couple form ───────────────────────────────────────────────────────────────
function CoupleForm({
  onClose,
  preselectedPartnerId,
}: {
  onClose: () => void
  preselectedPartnerId?: string
}) {
  const people = useActiveTree().people
  const addPerson = useFamilyStore((s) => s.addPerson)
  const addCouple = useFamilyStore((s) => s.addCouple)

  const personOptions = Object.values(people)
  const personLabel = (id: string) => {
    const p = people[id]
    return p ? `${p.firstName} ${p.lastName}`.trim() : id
  }

  const {
    handleSubmit,
    control,
    reset,
    watch,
    register,
    setValue,
    formState: { errors },
  } = useForm<CoupleFormData>({
    resolver: zodResolver(coupleSchema),
    defaultValues: {
      partner2Mode: preselectedPartnerId ? 'new' : 'existing',
      partner2Id: '',
      partner2FirstName: '',
      partner2LastName: '',
      partner2Gender: 'unknown',
      status: 'married',
      startDate: '',
      endDate: '',
    },
  })

  useEffect(() => {
    reset({
      partner2Mode: preselectedPartnerId ? 'new' : 'existing',
      partner2Id: '',
      partner2FirstName: '',
      partner2LastName: '',
      partner2Gender: 'unknown',
      status: 'married',
      startDate: '',
      endDate: '',
    })
  }, [preselectedPartnerId, reset])

  const status = watch('status')
  const partner2Mode = watch('partner2Mode')

  const onSubmit = (data: CoupleFormData) => {
    if (!preselectedPartnerId) return

    let partner2Id = data.partner2Id ?? ''
    if (data.partner2Mode === 'new') {
      partner2Id = nanoid()
      const firstName = data.partner2FirstName?.trim() ?? ''
      const lastName = data.partner2LastName?.trim() ?? ''
      addPerson({
        id: partner2Id,
        firstName,
        lastName,
        gender: data.partner2Gender,
        isDeceased: false,
        isPlaceholder: !firstName && !lastName,
      })
    }

    addCouple({
      id: nanoid(),
      partner1Id: preselectedPartnerId,
      partner2Id,
      status: data.status,
      startDate: data.startDate || undefined,
      endDate: data.endDate || undefined,
    })
    onClose()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Partner 1 — always the source person, no dropdown needed */}
      {preselectedPartnerId && (
        <div className="space-y-1.5">
          <Label>Person 1</Label>
          <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
            {personLabel(preselectedPartnerId)}
          </p>
        </div>
      )}

      {/* Partner 2 with new / existing tabs */}
      <div className="space-y-2">
        <Label>Person 2</Label>
        <PersonModeTabs
          value={partner2Mode}
          onValueChange={(v) => setValue('partner2Mode', v as 'new' | 'existing')}
        >
          <TabsContent value="new" className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>First Name</Label>
                <Input placeholder="First name" {...register('partner2FirstName')} />
              </div>
              <div className="space-y-1.5">
                <Label>Last Name</Label>
                <Input placeholder="Last name" {...register('partner2LastName')} />
              </div>
            </div>
            <p className="-mt-1 text-xs text-muted-foreground">
              Leave blank to add an unknown placeholder.
            </p>
            <div className="space-y-1.5">
              <Label>Gender</Label>
              <Controller
                name="partner2Gender"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
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
          </TabsContent>

          <TabsContent value="existing" className="space-y-1.5 pt-2">
            <Controller
              name="partner2Id"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  itemToStringLabel={personLabel}
                >
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
          </TabsContent>
        </PersonModeTabs>
      </div>

      {/* Status */}
      <div className="space-y-1.5">
        <Label>Relationship Status</Label>
        <Controller
          name="status"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={field.onChange}
              itemToStringLabel={(v) => statusLabels[v as string] ?? v}
            >
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

      <div
        className={`grid gap-3 ${status === 'divorced' ? 'grid-cols-2' : 'grid-cols-1'}`}
      >
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
  const { people, couples, parentChildren } = useActiveTree()
  const addPerson = useFamilyStore((s) => s.addPerson)
  const addParentChild = useFamilyStore((s) => s.addParentChild)

  const personOptions = Object.values(people)
  const coupleOptions = Object.values(couples)

  const personLabel = (id: string) => {
    const p = people[id]
    return p ? `${p.firstName} ${p.lastName}` : id
  }

  const coupleLabel = (id: string) => {
    const c = couples[id]
    if (!c) return id
    const p1 = people[c.partner1Id]
    const p2 = people[c.partner2Id]
    return `${p1 ? `${p1.firstName} ${p1.lastName}` : '?'} & ${p2 ? `${p2.firstName} ${p2.lastName}` : '?'}`
  }

  const {
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    register,
    setError,
    formState: { errors },
  } = useForm<ParentChildFormData>({
    resolver: zodResolver(parentChildSchema),
    defaultValues: {
      childMode: preselectedParentId ? 'new' : 'existing',
      childId: preselectedChildId ?? '',
      childFirstName: '',
      childLastName: '',
      childGender: 'unknown',
      parentType: preselectedParentId || preselectedChildId ? 'single' : 'couple',
      coupleId: '',
      singleParentMode: preselectedChildId ? 'new' : 'existing',
      singleParentId: preselectedParentId ?? '',
      singleParentFirstName: '',
      singleParentLastName: '',
      singleParentGender: 'unknown',
      type: 'biological',
    },
  })

  useEffect(() => {
    reset({
      childMode: preselectedParentId ? 'new' : 'existing',
      childId: preselectedChildId ?? '',
      childFirstName: '',
      childLastName: '',
      childGender: 'unknown',
      parentType: preselectedParentId || preselectedChildId ? 'single' : 'couple',
      coupleId: '',
      singleParentMode: preselectedChildId ? 'new' : 'existing',
      singleParentId: preselectedParentId ?? '',
      singleParentFirstName: '',
      singleParentLastName: '',
      singleParentGender: 'unknown',
      type: 'biological',
    })
  }, [preselectedParentId, preselectedChildId, reset])

  const parentType = watch('parentType')
  const childMode = watch('childMode')
  const singleParentMode = watch('singleParentMode')

  const onSubmit = (data: ParentChildFormData) => {
    // Resolve child id — create new person if needed
    let childId = data.childId ?? ''
    if (data.childMode === 'new') {
      childId = nanoid()
      const firstName = data.childFirstName?.trim() ?? ''
      const lastName = data.childLastName?.trim() ?? ''
      addPerson({
        id: childId,
        firstName,
        lastName,
        gender: data.childGender,
        isDeceased: false,
        isPlaceholder: !firstName && !lastName,
      })
    } else if (data.type === 'biological') {
      // Bio-parent limit check only applies to existing children (new child has 0 parents)
      const existingBioParents = Object.values(parentChildren).filter(
        (pc) => pc.childId === childId && pc.type === 'biological',
      )
      if (existingBioParents.length >= 2) {
        setError('type', { message: 'A child can have at most 2 biological parents' })
        return
      }
    }

    // Resolve single parent id — create new person if needed
    let singleParentId = data.singleParentId
    if (data.parentType === 'single' && data.singleParentMode === 'new') {
      const pid = nanoid()
      const firstName = data.singleParentFirstName?.trim() ?? ''
      const lastName = data.singleParentLastName?.trim() ?? ''
      addPerson({
        id: pid,
        firstName,
        lastName,
        gender: data.singleParentGender,
        isDeceased: false,
        isPlaceholder: !firstName && !lastName,
      })
      singleParentId = pid
    }

    addParentChild({
      id: nanoid(),
      childId,
      coupleId: data.parentType === 'couple' ? data.coupleId : undefined,
      singleParentId: data.parentType === 'single' ? singleParentId : undefined,
      type: data.type,
    })
    onClose()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Child slot */}
      <div className="space-y-2">
        <Label>Child</Label>
        {preselectedChildId ? (
          // Already determined — show name, no toggle needed
          <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
            {personLabel(preselectedChildId)}
          </p>
        ) : (
          <PersonModeTabs
              value={childMode}
              onValueChange={(v) => setValue('childMode', v as 'new' | 'existing')}
            >
              <TabsContent value="new" className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>First Name</Label>
                    <Input placeholder="First name" {...register('childFirstName')} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Last Name</Label>
                    <Input placeholder="Last name" {...register('childLastName')} />
                  </div>
                </div>
                <p className="-mt-1 text-xs text-muted-foreground">
                  Leave blank to add an unknown placeholder.
                </p>
                <div className="space-y-1.5">
                  <Label>Gender</Label>
                  <Controller
                    name="childGender"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
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
              </TabsContent>

              <TabsContent value="existing" className="space-y-1.5 pt-2">
                <Controller
                  name="childId"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      itemToStringLabel={personLabel}
                    >
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
              </TabsContent>
            </PersonModeTabs>
        )}
      </div>

      {/* Parent type */}
      <div className="space-y-1.5">
        <Label>Parent Type</Label>
        <Controller
          name="parentType"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={field.onChange}
              itemToStringLabel={(v) => parentTypeLabels[v as string] ?? v}
            >
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

      {/* Couple parent slot */}
      {parentType === 'couple' && (
        <div className="space-y-1.5">
          <Label>Parent Couple</Label>
          <Controller
            name="coupleId"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                itemToStringLabel={coupleLabel}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select couple..." />
                </SelectTrigger>
                <SelectContent>
                  {coupleOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {coupleLabel(c.id)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.coupleId && (
            <p className="text-xs text-destructive">{errors.coupleId.message}</p>
          )}
        </div>
      )}

      {/* Single parent slot */}
      {parentType === 'single' && (
        <div className="space-y-2">
          <Label>Parent</Label>
          {preselectedParentId ? (
            // Already determined — show name, no toggle needed
            <p className="rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
              {personLabel(preselectedParentId)}
            </p>
          ) : (
            <PersonModeTabs
              value={singleParentMode}
              onValueChange={(v) => setValue('singleParentMode', v as 'new' | 'existing')}
            >
              <TabsContent value="new" className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>First Name</Label>
                    <Input
                      placeholder="First name"
                      {...register('singleParentFirstName')}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Last Name</Label>
                    <Input
                      placeholder="Last name"
                      {...register('singleParentLastName')}
                    />
                  </div>
                </div>
                <p className="-mt-1 text-xs text-muted-foreground">
                  Leave blank to add an unknown placeholder.
                </p>
                <div className="space-y-1.5">
                  <Label>Gender</Label>
                  <Controller
                    name="singleParentGender"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
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
              </TabsContent>

              <TabsContent value="existing" className="pt-2">
                <Controller
                  name="singleParentId"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      itemToStringLabel={personLabel}
                    >
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
              </TabsContent>
            </PersonModeTabs>
          )}
        </div>
      )}

      {/* Relationship type */}
      <div className="space-y-1.5">
        <Label>Relationship Type</Label>
        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value}
              onValueChange={field.onChange}
              itemToStringLabel={(v) => relationshipTypeLabels[v as string] ?? v}
            >
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
interface AddRelationshipDialogProps {
  open: boolean
  onClose: () => void
  mode: 'couple' | 'parentChild'
  preselectedPartnerId?: string
  preselectedParentId?: string
  preselectedChildId?: string
}

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
            {mode === 'couple'
              ? 'Add Partner Relationship'
              : 'Add Parent-Child Relationship'}
          </DialogTitle>
        </DialogHeader>

        {mode === 'couple' ? (
          <CoupleForm
            onClose={onClose}
            preselectedPartnerId={preselectedPartnerId}
          />
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
