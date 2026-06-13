/**
 * Whole-years age between birth and a reference date.
 *
 * - Living person → age as of today.
 * - Deceased person → age at death (uses `deathDate`, else returns null).
 *
 * Returns null when the birth date is missing/invalid, the reference date is
 * invalid, or the result would be negative.
 */
export function calculateAge(birthDate?: string, deathDate?: string): number | null {
  if (!birthDate) return null
  const birth = new Date(birthDate)
  if (Number.isNaN(birth.getTime())) return null

  const end = deathDate ? new Date(deathDate) : new Date()
  if (Number.isNaN(end.getTime())) return null

  let age = end.getFullYear() - birth.getFullYear()
  const monthDiff = end.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && end.getDate() < birth.getDate())) {
    age -= 1
  }

  return age < 0 ? null : age
}
