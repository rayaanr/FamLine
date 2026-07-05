import type { Couple, FamilyTree, Person } from "../types";

/**
 * Every person below `personId` in the tree - their children (through any
 * couple or as a single parent), those children's married-in partners, and so
 * on recursively. Excludes the person themselves. Matches the count shown when
 * collapsing a branch, and is the set removed by a "delete entire branch".
 */
export function getDescendantIds(
  tree: FamilyTree,
  personId: string,
): Set<string> {
  const { couples, parentChildren } = tree;

  // Index maps built once, up front — the recursive walk below visits many
  // nodes, and re-filtering all couples/parentChildren per node (as the old
  // version did) is O(n²) on a large branch.
  const couplesByPerson = new Map<string, Couple[]>();
  for (const c of Object.values(couples)) {
    for (const pid of [c.partner1Id, c.partner2Id]) {
      const arr = couplesByPerson.get(pid);
      if (arr) arr.push(c);
      else couplesByPerson.set(pid, [c]);
    }
  }
  const childrenByCouple = new Map<string, string[]>();
  const childrenBySingleParent = new Map<string, string[]>();
  for (const pc of Object.values(parentChildren)) {
    if (pc.coupleId) {
      const arr = childrenByCouple.get(pc.coupleId);
      if (arr) arr.push(pc.childId);
      else childrenByCouple.set(pc.coupleId, [pc.childId]);
    } else if (pc.singleParentId) {
      const arr = childrenBySingleParent.get(pc.singleParentId);
      if (arr) arr.push(pc.childId);
      else childrenBySingleParent.set(pc.singleParentId, [pc.childId]);
    }
  }

  const couplesOf = (pid: string) => couplesByPerson.get(pid) ?? [];
  const childrenOfCouple = (cid: string) => childrenByCouple.get(cid) ?? [];
  const soleChildrenOf = (pid: string) => childrenBySingleParent.get(pid) ?? [];
  const otherPartner = (c: Couple, id: string) =>
    c.partner1Id === id ? c.partner2Id : c.partner1Id;

  const acc = new Set<string>();

  const visitChild = (childId: string) => {
    if (acc.has(childId)) return;
    acc.add(childId);
    // Pull in married-in partners of this descendant.
    for (const c of couplesOf(childId)) {
      const spouse = otherPartner(c, childId);
      acc.add(spouse);
    }
    visit(childId);
  };

  const visit = (pid: string) => {
    for (const c of couplesOf(pid)) {
      for (const childId of childrenOfCouple(c.id)) visitChild(childId);
    }
    for (const childId of soleChildrenOf(pid)) visitChild(childId);
  };

  visit(personId);
  acc.delete(personId);
  return acc;
}

export interface CloseRelations {
  parents: Person[];
  partners: Person[];
  siblings: Person[];
  children: Person[];
}

/**
 * The immediate family around one person: parents, partners, siblings and
 * children. Each list is de-duplicated and excludes the person themselves.
 */
export function getCloseRelations(
  tree: FamilyTree,
  personId: string,
): CloseRelations {
  const { people, couples, parentChildren } = tree;

  const parents = new Set<string>();
  const partners = new Set<string>();
  const siblings = new Set<string>();
  const children = new Set<string>();

  // The parent "anchors" (couple ids / single-parent ids) this person descends
  // from - used to find siblings (others sharing the same anchor).
  const parentCoupleIds = new Set<string>();
  const parentSingleIds = new Set<string>();

  // Partners - the other side of every couple this person belongs to.
  for (const c of Object.values(couples)) {
    if (c.partner1Id === personId) partners.add(c.partner2Id);
    else if (c.partner2Id === personId) partners.add(c.partner1Id);
  }

  for (const pc of Object.values(parentChildren)) {
    // Parents of this person.
    if (pc.childId === personId) {
      if (pc.coupleId && couples[pc.coupleId]) {
        parentCoupleIds.add(pc.coupleId);
        parents.add(couples[pc.coupleId].partner1Id);
        parents.add(couples[pc.coupleId].partner2Id);
      } else if (pc.singleParentId && people[pc.singleParentId]) {
        parentSingleIds.add(pc.singleParentId);
        parents.add(pc.singleParentId);
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
      children.add(pc.childId);
    }
  }

  // Siblings - others who share a parent anchor with this person.
  for (const pc of Object.values(parentChildren)) {
    if (pc.childId === personId) continue;
    const sharesCouple = pc.coupleId ? parentCoupleIds.has(pc.coupleId) : false;
    const sharesSingle = pc.singleParentId
      ? parentSingleIds.has(pc.singleParentId)
      : false;
    if (sharesCouple || sharesSingle) siblings.add(pc.childId);
  }

  // Oldest first; people with an unknown/invalid birth date sort to the end.
  const dobValue = (p: Person) => {
    const t = p.birthDate ? new Date(p.birthDate).getTime() : NaN;
    return Number.isNaN(t) ? Infinity : t;
  };
  const toPeople = (ids: Set<string>) =>
    [...ids]
      .map((id) => people[id])
      .filter((p): p is Person => Boolean(p))
      .sort((a, b) => dobValue(a) - dobValue(b));

  return {
    parents: toPeople(parents),
    partners: toPeople(partners),
    siblings: toPeople(siblings),
    children: toPeople(children),
  };
}
