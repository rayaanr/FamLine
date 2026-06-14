import type { Person } from '../types'

/** True when a person has no name on record (a placeholder/unknown). */
export function isPlaceholderPerson(p: Person): boolean {
  return p.isPlaceholder ?? (!p.firstName?.trim() && !p.lastName?.trim())
}

/** Display name, falling back to "Unknown" for placeholders. */
export function personDisplayName(p: Person): string {
  const name = `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim()
  return name || 'Unknown'
}

/** Two-letter initials for avatars, "?" for placeholders. */
export function personInitials(p: Person): string {
  const initials = `${p.firstName?.[0] ?? ''}${p.lastName?.[0] ?? ''}`.toUpperCase()
  return initials || '?'
}
