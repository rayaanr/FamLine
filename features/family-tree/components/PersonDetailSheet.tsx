'use client'

import { useQueryState } from 'nuqs'
import {
  Pencil, Cake, Calendar, StickyNote, Mars, Venus, NonBinary, CircleHelp,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { useActiveTree } from '../hooks/useFamilyStore'

const genderIcon: Record<string, LucideIcon> = {
  male: Mars,
  female: Venus,
  other: NonBinary,
  unknown: CircleHelp,
}

const genderLabel: Record<string, string> = {
  male: 'Male',
  female: 'Female',
  other: 'Non-binary',
  unknown: 'Unknown',
}

const genderIconColor: Record<string, string> = {
  male: 'text-blue-500',
  female: 'text-pink-500',
  other: 'text-purple-500',
  unknown: 'text-muted-foreground',
}

const avatarStyles: Record<string, string> = {
  male: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200',
  female: 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-200',
  other: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200',
  unknown: 'bg-muted text-muted-foreground',
}

function formatDate(iso?: string) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

function DetailRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-sm text-foreground">{value}</div>
      </div>
    </div>
  )
}

export function PersonDetailSheet({ onEdit }: { onEdit: (id: string) => void }) {
  const [personId, setPersonId] = useQueryState('person')
  const tree = useActiveTree()
  const person = personId ? tree.people[personId] : undefined

  const open = !!person

  const close = () => setPersonId(null)

  const handleEdit = () => {
    if (!person) return
    const id = person.id
    close()
    onEdit(id)
  }

  const GenderIcon = person ? genderIcon[person.gender] : CircleHelp
  const initials = person
    ? `${person.firstName?.[0] ?? ''}${person.lastName?.[0] ?? ''}`.toUpperCase() || '?'
    : '?'

  const birth = formatDate(person?.birthDate)
  const death = formatDate(person?.deathDate)

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) close() }}>
      <SheetContent side="right" className="gap-0">
        {person && (
          <>
            <SheetHeader className="flex-row items-center gap-3">
              <Avatar size="lg" className={cn('shrink-0', avatarStyles[person.gender])}>
                <AvatarFallback className={cn('font-semibold', avatarStyles[person.gender])}>
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <SheetTitle className="truncate text-lg">
                  {person.firstName} {person.lastName}
                </SheetTitle>
                <SheetDescription className="flex items-center gap-1.5">
                  <GenderIcon className={cn('size-3.5', genderIconColor[person.gender])} />
                  {genderLabel[person.gender]}
                  {person.isDeceased && <span className="text-muted-foreground">· Deceased †</span>}
                </SheetDescription>
              </div>
            </SheetHeader>

            <Separator />

            <div className="flex flex-col gap-4 p-4">
              <DetailRow
                icon={Cake}
                label="Born"
                value={birth ?? <span className="text-muted-foreground">Unknown</span>}
              />
              {(person.isDeceased || death) && (
                <DetailRow
                  icon={Calendar}
                  label="Died"
                  value={death ?? <span className="text-muted-foreground">Unknown</span>}
                />
              )}
              {person.notes && (
                <DetailRow
                  icon={StickyNote}
                  label="Notes"
                  value={<p className="whitespace-pre-wrap">{person.notes}</p>}
                />
              )}
            </div>

            <SheetFooter>
              <Button onClick={handleEdit} variant="outline">
                <Pencil />
                Edit details
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
