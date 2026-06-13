import type { FamilyTree, Person } from '../types'

export interface CloseRelations {
  parents: Person[]
  partners: Person[]
  siblings: Person[]
  children: Person[]
}

/**
 * The immediate family around one person: parents, partners, siblings and
 * children. Each list is de-duplicated and excludes the person themselves.
 */
export function getCloseRelations(tree: FamilyTree, personId: string): CloseRelations {
  const { people, couples, parentChildren } = tree

  const parents = new Set<string>()
  const partners = new Set<string>()
  const siblings = new Set<string>()
  const children = new Set<string>()

  // The parent "anchors" (couple ids / single-parent ids) this person descends
  // from — used to find siblings (others sharing the same anchor).
  const parentCoupleIds = new Set<string>()
  const parentSingleIds = new Set<string>()

  // Partners — the other side of every couple this person belongs to.
  for (const c of Object.values(couples)) {
    if (c.partner1Id === personId) partners.add(c.partner2Id)
    else if (c.partner2Id === personId) partners.add(c.partner1Id)
  }

  for (const pc of Object.values(parentChildren)) {
    // Parents of this person.
    if (pc.childId === personId) {
      if (pc.coupleId && couples[pc.coupleId]) {
        parentCoupleIds.add(pc.coupleId)
        parents.add(couples[pc.coupleId].partner1Id)
        parents.add(couples[pc.coupleId].partner2Id)
      } else if (pc.singleParentId && people[pc.singleParentId]) {
        parentSingleIds.add(pc.singleParentId)
        parents.add(pc.singleParentId)
      }
    }

    // Children of this person.
    if (
      (pc.coupleId &&
        couples[pc.coupleId] &&
        (couples[pc.coupleId].partner1Id === personId ||
          couples[pc.coupleId].partner2Id === personId)) ||
      pc.singleParentId === personId
    ) {
      children.add(pc.childId)
    }
  }

  // Siblings — others who share a parent anchor with this person.
  for (const pc of Object.values(parentChildren)) {
    if (pc.childId === personId) continue
    const sharesCouple = pc.coupleId ? parentCoupleIds.has(pc.coupleId) : false
    const sharesSingle = pc.singleParentId ? parentSingleIds.has(pc.singleParentId) : false
    if (sharesCouple || sharesSingle) siblings.add(pc.childId)
  }

  // Oldest first; people with an unknown/invalid birth date sort to the end.
  const dobValue = (p: Person) => {
    const t = p.birthDate ? new Date(p.birthDate).getTime() : NaN
    return Number.isNaN(t) ? Infinity : t
  }
  const toPeople = (ids: Set<string>) =>
    [...ids]
      .map((id) => people[id])
      .filter((p): p is Person => Boolean(p))
      .sort((a, b) => dobValue(a) - dobValue(b))

  return {
    parents: toPeople(parents),
    partners: toPeople(partners),
    siblings: toPeople(siblings),
    children: toPeople(children),
  }
}
