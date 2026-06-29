export type Gender = 'male' | 'female' | 'other' | 'unknown'
export type CoupleStatus = 'married' | 'divorced' | 'separated' | 'partnered'
export type ParentChildType = 'biological' | 'adopted' | 'step'

export interface Person {
  id: string
  firstName: string
  lastName: string
  birthDate?: string
  deathDate?: string
  isDeceased: boolean
  gender: Gender
  notes?: string
  // A structural connector you don't have details for yet (e.g. an unknown
  // parent linking two known generations). Filled in later.
  isPlaceholder?: boolean
}

export interface Couple {
  id: string
  partner1Id: string
  partner2Id: string
  status: CoupleStatus
  startDate?: string
  endDate?: string
}

export interface ParentChild {
  id: string
  childId: string
  coupleId?: string
  singleParentId?: string
  type: ParentChildType
}

export interface FamilyTree {
  people: Record<string, Person>
  couples: Record<string, Couple>
  parentChildren: Record<string, ParentChild>
  // Node ids (`couple-<id>` / `person-<id>`) whose descendants are collapsed.
  collapsed: string[]
}

/** A named, identifiable family tree. The app can hold many of these. */
export interface NamedFamilyTree extends FamilyTree {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

// ── Media (profile photos, documents, gallery) ───────────────────────────────
/** Who, beyond editors/owners, may view sensitive member documents. */
export type DocumentVisibility = 'editors' | 'members'

/** Per-tree settings, stored in its own DB column (never in the graph blob). */
export interface TreeSettings {
  documentVisibility: DocumentVisibility
}

export const DEFAULT_TREE_SETTINGS: TreeSettings = {
  documentVisibility: 'editors',
}

/** What a stored file represents. */
export type MediaKind = 'profile' | 'document'

/** Category for an identity document. */
export type DocType = 'birth_certificate' | 'nic' | 'passport' | 'other'

export const DOC_TYPES: DocType[] = ['birth_certificate', 'nic', 'passport', 'other']

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  birth_certificate: 'Birth certificate',
  nic: 'National ID',
  passport: 'Passport',
  other: 'Other',
}

/** A stored file, as returned to the client (with a fresh presigned `url`). */
export interface MediaAssetView {
  id: string
  kind: MediaKind
  docType: DocType | null
  fileName: string
  contentType: string
  size: number
  createdAt: string
  /** Short-lived presigned GET URL for viewing/thumbnailing. */
  url: string
}
