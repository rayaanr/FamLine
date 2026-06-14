'use client'

import { useQueryState } from 'nuqs'
import {
  Pencil, Cake, Calendar, StickyNote, Hourglass, Users,
  Mars, Venus, NonBinary, CircleHelp,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
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
import { calculateAge } from '../utils/age'
import { getCloseRelations } from '../utils/relations'
import { personDisplayName, personInitials, isPlaceholderPerson } from '../utils/person'
import type { Person } from '../types'

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

const badgeStyles: Record<string, string> = {
  male: 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-200 dark:hover:bg-blue-900',
  female: 'border-pink-300 bg-pink-50 text-pink-700 hover:bg-pink-100 dark:border-pink-700 dark:bg-pink-950 dark:text-pink-200 dark:hover:bg-pink-900',
  other: 'border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100 dark:border-purple-700 dark:bg-purple-950 dark:text-purple-200 dark:hover:bg-purple-900',
  unknown: 'border-border bg-muted text-muted-foreground hover:bg-muted/70',
}

function formatDate(iso?: string) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

function ageSummary(person: Person) {
  const age = calculateAge(person.birthDate, person.isDeceased ? person.deathDate : undefined)
  if (age === null) return null
  return person.isDeceased ? `Died at age ${age}` : `${age} years old`
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

function RelationGroup({
  label,
  people,
  onSelect,
}: {
  label: string
  people: Person[]
  onSelect: (id: string) => void
}) {
  if (people.length === 0) return null
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {people.map((p) => (
          <Badge
            key={p.id}
            variant="outline"
            className={cn('cursor-pointer', badgeStyles[p.gender])}
            render={<button type="button" onClick={() => onSelect(p.id)} />}
          >
            {personDisplayName(p)}
          </Badge>
        ))}
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

  const birth = formatDate(person?.birthDate)
  const death = formatDate(person?.deathDate)
  const age = person ? ageSummary(person) : null
  const relations = person ? getCloseRelations(tree, person.id) : null
  const hasRelations =
    relations &&
    relations.parents.length +
      relations.partners.length +
      relations.siblings.length +
      relations.children.length >
      0

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) close() }}>
      <SheetContent side="right" className="gap-0">
        {person && relations && (
          <>
            <SheetHeader className="flex-row items-center gap-3">
              <Avatar
                size="lg"
                className={cn('shrink-0', avatarStyles[person.gender], isPlaceholderPerson(person) && 'border border-dashed border-border')}
              >
                <AvatarFallback className={cn('font-semibold', avatarStyles[person.gender])}>
                  {personInitials(person)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <SheetTitle className={cn('truncate text-lg', isPlaceholderPerson(person) && 'italic text-muted-foreground')}>
                  {personDisplayName(person)}
                </SheetTitle>
                <SheetDescription className="flex items-center gap-1.5">
                  <GenderIcon className={cn('size-3.5', genderIconColor[person.gender])} />
                  {genderLabel[person.gender]}
                  {isPlaceholderPerson(person) && <span className="text-muted-foreground">· Needs details</span>}
                  {person.isDeceased && <span className="text-muted-foreground">· Deceased †</span>}
                </SheetDescription>
              </div>
            </SheetHeader>

            <Separator />

            <div className="flex-1 overflow-y-auto">
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
                {age && <DetailRow icon={Hourglass} label="Age" value={age} />}
                {person.notes && (
                  <DetailRow
                    icon={StickyNote}
                    label="Notes"
                    value={<p className="whitespace-pre-wrap">{person.notes}</p>}
                  />
                )}
              </div>

              {hasRelations && (
                <>
                  <Separator />
                  <div className="p-4">
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Users className="size-3.5" />
                      Close relations
                    </p>
                    <div className="space-y-3">
                      <RelationGroup label="Parents" people={relations.parents} onSelect={setPersonId} />
                      <RelationGroup label="Partners" people={relations.partners} onSelect={setPersonId} />
                      <RelationGroup label="Siblings" people={relations.siblings} onSelect={setPersonId} />
                      <RelationGroup label="Children" people={relations.children} onSelect={setPersonId} />
                    </div>
                  </div>
                </>
              )}
            </div>

            <SheetFooter>
              <Button onClick={handleEdit} variant="outline">
                <Pencil />
                {isPlaceholderPerson(person) ? 'Add details' : 'Edit details'}
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
