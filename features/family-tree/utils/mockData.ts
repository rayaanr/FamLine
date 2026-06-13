import type {
  FamilyTree,
  Person,
  Couple,
  ParentChild,
  Gender,
  CoupleStatus,
  ParentChildType,
} from '../types'

// ── Deterministic PRNG (mulberry32) ──────────────────────────────────────────
// A fixed seed keeps "Load Demo" reproducible across reloads & persistence.
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const MALE_NAMES = [
  'James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph',
  'Thomas', 'Charles', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Steven', 'Paul',
  'Andrew', 'Kevin', 'Brian', 'George', 'Edward', 'Timothy', 'Henry', 'Peter',
  'Walter', 'Frank', 'Jack', 'Samuel', 'Benjamin', 'Ethan', 'Noah', 'Liam',
  'Lucas', 'Leo', 'Owen', 'Felix', 'Oliver', 'Max', 'Jasper', 'Theodore',
]
const FEMALE_NAMES = [
  'Mary', 'Patricia', 'Jennifer', 'Linda', 'Elizabeth', 'Barbara', 'Susan',
  'Jessica', 'Sarah', 'Karen', 'Nancy', 'Margaret', 'Sandra', 'Dorothy', 'Emily',
  'Carol', 'Amanda', 'Rebecca', 'Laura', 'Helen', 'Anna', 'Emma', 'Nicole',
  'Katherine', 'Christine', 'Rachel', 'Olivia', 'Sophie', 'Grace', 'Chloe',
  'Ruby', 'Ella', 'Zoe', 'Mia', 'Ava', 'Lily', 'Hazel', 'Aria', 'Nina', 'Ivy',
]
const SURNAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Wilson', 'Anderson', 'Taylor', 'Thomas', 'Moore', 'Jackson', 'Martin', 'Lee',
  'Park', 'Carter', 'Green', 'Foster', 'Hughes', 'Adams', 'Reed', 'Morgan',
  'Bennett', 'Cruz', 'Patel', 'Bell', 'Ward', 'Cooper', 'Bailey', 'Hayes',
  'Price', 'Wood', 'Reyes', 'Rivera', 'Cole', 'Hart', 'Lane', 'Shaw',
]

const CURRENT_YEAR = 2026
const GENERATIONS = 10      // depth of the tree (generations 0…9)
const GEN_GAP = 30          // years between generations
const BASE_YEAR = CURRENT_YEAR - (GENERATIONS - 1) * GEN_GAP - 16 // → ~1730
const MAX_COUPLES_PER_GEN = 7 // caps lateral growth so population stays bounded
const POP_CAP = 240

interface CoupleSeed {
  coupleId: string
  childSurname: string // surname passed to this couple's children (the father's line)
}

/**
 * A procedurally generated ten-generation family (~200 people) descending from
 * a single founding couple. Family sizes vary — most couples have 1–4 children,
 * but some have 7–10. Growth is capped per generation so the tree stays a clean,
 * renderable hierarchy rather than exploding combinatorially.
 */
export function buildMockFamily(): Omit<FamilyTree, 'collapsed'> {
  const rand = mulberry32(0x5a3c91)

  const people: Record<string, Person> = {}
  const couples: Record<string, Couple> = {}
  const parentChildren: Record<string, ParentChild> = {}

  let pSeq = 0
  let cSeq = 0
  let pcSeq = 0

  const randInt = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)]
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = (year: number) => `${year}-${pad(randInt(1, 12))}-${pad(randInt(1, 28))}`

  const makePerson = (gender: Gender, lastName: string, birthYear: number): string => {
    const id = `p${++pSeq}`
    const lifespan = randInt(66, 94)
    const deceased = birthYear + lifespan <= CURRENT_YEAR
    const person: Person = {
      id,
      firstName: gender === 'male' ? pick(MALE_NAMES) : pick(FEMALE_NAMES),
      lastName,
      gender,
      isDeceased: deceased,
      birthDate: date(birthYear),
    }
    if (deceased) person.deathDate = date(birthYear + lifespan)
    people[id] = person
    return id
  }

  const coupleStatus = (): CoupleStatus => {
    const r = rand()
    if (r < 0.08) return 'divorced'
    if (r < 0.12) return 'separated'
    if (r < 0.18) return 'partnered'
    return 'married'
  }

  const makeCouple = (p1: string, p2: string, marriageYear: number): string => {
    const id = `c${++cSeq}`
    couples[id] = {
      id,
      partner1Id: p1,
      partner2Id: p2,
      status: coupleStatus(),
      startDate: date(marriageYear),
    }
    return id
  }

  const pcType = (): ParentChildType => {
    const r = rand()
    if (r < 0.05) return 'adopted'
    if (r < 0.08) return 'step'
    return 'biological'
  }

  const linkChild = (childId: string, coupleId: string) => {
    const id = `pc${++pcSeq}`
    parentChildren[id] = { id, childId, coupleId, type: pcType() }
  }

  const childCount = (): number => {
    const r = rand()
    if (r < 0.13) return randInt(7, 10) // big family
    if (r < 0.22) return 0
    return randInt(1, 4)
  }

  const surnameOf = (id: string) => people[id].lastName

  // ── Founding couple (generation 0) ─────────────────────────────────────────
  const foundingSurname = pick(SURNAMES)
  const founderH = makePerson('male', foundingSurname, BASE_YEAR + randInt(-2, 1))
  const founderW = makePerson('female', pick(SURNAMES), BASE_YEAR + randInt(0, 4))
  const c0 = makeCouple(founderH, founderW, BASE_YEAR + 24)

  let frontier: CoupleSeed[] = [{ coupleId: c0, childSurname: foundingSurname }]

  // ── Grow generation by generation ──────────────────────────────────────────
  for (let gen = 1; gen < GENERATIONS && frontier.length > 0; gen++) {
    const birthYear = BASE_YEAR + gen * GEN_GAP
    const canMarry = gen < GENERATIONS - 1 // the last generation are leaves
    const next: CoupleSeed[] = []
    let newCouples = 0

    frontier.forEach((parent, parentIdx) => {
      const isSpine = parentIdx === 0 // guarantees the tree reaches full depth
      let kids = childCount()
      if (isSpine && kids === 0) kids = 1

      const children: { id: string; gender: Gender }[] = []
      for (let k = 0; k < kids; k++) {
        if (!isSpine && pSeq >= POP_CAP) break
        const gender: Gender = rand() < 0.5 ? 'male' : 'female'
        const childId = makePerson(gender, parent.childSurname, birthYear + randInt(-4, 4))
        linkChild(childId, parent.coupleId)
        children.push({ id: childId, gender })
      }

      children.forEach((child, childIdx) => {
        const forced = isSpine && childIdx === 0 && canMarry
        const allowed =
          canMarry &&
          newCouples < MAX_COUPLES_PER_GEN &&
          pSeq < POP_CAP &&
          rand() < 0.55
        if (!forced && !allowed) return

        const spouseGender: Gender = child.gender === 'male' ? 'female' : 'male'
        const spouseId = makePerson(spouseGender, pick(SURNAMES), birthYear + randInt(-4, 4))
        const coupleId = makeCouple(child.id, spouseId, birthYear + randInt(22, 30))
        const fatherId = child.gender === 'male' ? child.id : spouseId
        next.push({ coupleId, childSurname: surnameOf(fatherId) })
        newCouples++
      })
    })

    frontier = next
  }

  return { people, couples, parentChildren }
}
