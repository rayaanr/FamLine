'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useQueryState } from 'nuqs'
import {
  Pencil, Cake, Calendar, StickyNote, Hourglass, Users, Trash2,
  CircleHelp,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { useActiveTree } from '../hooks/useFamilyStore'
import { useTreeAccess } from '../hooks/useTreeAccess'
import { calculateAge } from '../utils/age'
import { getCloseRelations } from '../utils/relations'
import { genderConfig } from '../utils/genderConfig'
import { personDisplayName, personInitials, isPlaceholderPerson } from '../utils/person'
import { DeletePersonDialog } from './dialogs/DeletePersonDialog'
import { MemberDocuments } from './media/MemberDocuments'
import { MemberProfilePhoto } from './media/MemberProfilePhoto'
import { useProfilePhotos } from '../hooks/useProfilePhotos'
import { listMemberMedia } from '../server/media-actions'
import type { Person, MediaAssetView } from '../types'

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
            className={cn('cursor-pointer', genderConfig[p.gender].badgeClass)}
            render={<button type="button" onClick={() => onSelect(p.id)} />}
          >
            {personDisplayName(p)}
          </Badge>
        ))}
      </div>
    </div>
  )
}

function DetailsSection({
  person,
  birth,
  death,
  age,
  relations,
  hasRelations,
  onSelect,
}: {
  person: Person
  birth: string | null
  death: string | null
  age: string | null
  relations: ReturnType<typeof getCloseRelations>
  hasRelations: boolean
  onSelect: (id: string) => void
}) {
  return (
    <>
      <div className="flex flex-col gap-4 p-4">
        <DetailRow
          icon={Cake}
          label="Born"
          value={
            birth || person.birthPlace ? (
              <>
                {birth ?? <span className="text-muted-foreground">Unknown date</span>}
                {person.birthPlace && (
                  <span className="text-muted-foreground">
                    {birth ? ' · ' : ''}
                    {person.birthPlace}
                  </span>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">Unknown</span>
            )
          }
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
              <RelationGroup label="Parents" people={relations.parents} onSelect={onSelect} />
              <RelationGroup label="Partners" people={relations.partners} onSelect={onSelect} />
              <RelationGroup label="Siblings" people={relations.siblings} onSelect={onSelect} />
              <RelationGroup label="Children" people={relations.children} onSelect={onSelect} />
            </div>
          </div>
        </>
      )}
    </>
  )
}

interface MemberMedia {
  forId: string | null
  profile: MediaAssetView | null
  documents: MediaAssetView[]
}

const emptyMedia: MemberMedia = { forId: null, profile: null, documents: [] }

export function PersonDetailSheet({ onEdit }: { onEdit: (id: string) => void }) {
  const [personId, setPersonId] = useQueryState('person')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { canEdit } = useTreeAccess()
  const tree = useActiveTree()
  const person = personId ? tree.people[personId] : undefined
  const showMedia = !!person && !isPlaceholderPerson(person)

  const [loaded, setLoaded] = useState<MemberMedia>(emptyMedia)
  const { refresh: refreshPhotos } = useProfilePhotos()

  // Tag fetched media with its person id; ignore it if the selection moved on,
  // so we never flash the previous member's photo while loading.
  const media = loaded.forId === personId && showMedia ? loaded : emptyMedia

  const refreshMedia = useCallback(() => {
    if (!personId) return
    const pid = personId
    listMemberMedia(tree.id, pid)
      .then((m) => setLoaded({ forId: pid, ...m }))
      .catch(() => {})
  }, [personId, tree.id])

  useEffect(() => {
    if (showMedia) refreshMedia()
  }, [showMedia, refreshMedia])

  // Profile photo changed in the uploader: refresh the sheet + the node thumbnails.
  const onPhotoChanged = useCallback(() => {
    refreshMedia()
    refreshPhotos()
  }, [refreshMedia, refreshPhotos])

  const open = !!person

  const close = () => setPersonId(null)

  const handleEdit = () => {
    if (!person) return
    const id = person.id
    close()
    onEdit(id)
  }

  const GenderIcon = person ? genderConfig[person.gender].icon : CircleHelp

  const birth = formatDate(person?.birthDate)
  const death = formatDate(person?.deathDate)
  const age = person ? ageSummary(person) : null
  const relations = useMemo(
    () => (person ? getCloseRelations(tree, person.id) : null),
    [tree, person],
  )
  const hasRelations =
    relations &&
    relations.parents.length +
      relations.partners.length +
      relations.siblings.length +
      relations.children.length >
      0

  return (
    <>
    <Sheet open={open} onOpenChange={(o) => { if (!o) close() }}>
      <SheetContent side="right" className="gap-0">
        {person && relations && (
          <>
            <SheetHeader className="flex-row items-center gap-3">
              {showMedia ? (
                <MemberProfilePhoto
                  treeId={tree.id}
                  personId={person.id}
                  profile={media.profile}
                  canEdit={canEdit}
                  name={personDisplayName(person)}
                  fallback={personInitials(person)}
                  className={genderConfig[person.gender].avatarBg}
                  onChanged={onPhotoChanged}
                />
              ) : (
                <Avatar
                  size="lg"
                  className={cn('shrink-0', genderConfig[person.gender].avatarBg, isPlaceholderPerson(person) && 'border border-dashed border-border')}
                >
                  <AvatarFallback className={cn('font-semibold', genderConfig[person.gender].avatarBg)}>
                    {personInitials(person)}
                  </AvatarFallback>
                </Avatar>
              )}
              <div className="min-w-0">
                <SheetTitle className={cn('truncate text-lg', isPlaceholderPerson(person) && 'italic text-muted-foreground')}>
                  {personDisplayName(person)}
                </SheetTitle>
                <SheetDescription className="flex items-center gap-1.5">
                  <GenderIcon className={cn('size-3.5', genderConfig[person.gender].iconColor)} />
                  {genderConfig[person.gender].label}
                  {isPlaceholderPerson(person) && <span className="text-muted-foreground">· Needs details</span>}
                  {person.isDeceased && <span className="text-muted-foreground">· Deceased †</span>}
                </SheetDescription>
              </div>
            </SheetHeader>

            <Separator />

            {showMedia ? (
              <Tabs defaultValue="details" className="min-h-0 flex-1 gap-0">
                <div className="px-4 pt-3">
                  <TabsList className="w-full">
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="files">
                      Files
                      {media.documents.length > 0 && (
                        <span className="text-muted-foreground">· {media.documents.length}</span>
                      )}
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="details" className="min-h-0 overflow-y-auto">
                  <DetailsSection
                    person={person}
                    birth={birth}
                    death={death}
                    age={age}
                    relations={relations}
                    hasRelations={!!hasRelations}
                    onSelect={setPersonId}
                  />
                </TabsContent>

                <TabsContent value="files" className="min-h-0 overflow-y-auto">
                  <div className="p-4">
                    <MemberDocuments
                      treeId={tree.id}
                      personId={person.id}
                      documents={media.documents}
                      canEdit={canEdit}
                      onChanged={refreshMedia}
                    />
                  </div>
                </TabsContent>
              </Tabs>
            ) : (
              <div className="flex-1 overflow-y-auto">
                <DetailsSection
                  person={person}
                  birth={birth}
                  death={death}
                  age={age}
                  relations={relations}
                  hasRelations={!!hasRelations}
                  onSelect={setPersonId}
                />
              </div>
            )}

            {canEdit && (
              <SheetFooter className="flex-row justify-between">
                <Button
                  onClick={() => setConfirmDelete(true)}
                  variant="ghost"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 />
                  Delete
                </Button>
                <Button onClick={handleEdit} variant="outline">
                  <Pencil />
                  {isPlaceholderPerson(person) ? 'Add details' : 'Edit details'}
                </Button>
              </SheetFooter>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>

    <DeletePersonDialog
      open={confirmDelete}
      personId={personId}
      onClose={() => setConfirmDelete(false)}
      onDeleted={() => {
        setConfirmDelete(false)
        close()
      }}
    />
    </>
  )
}
