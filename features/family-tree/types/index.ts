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
}
