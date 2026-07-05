import { Mars, Venus, NonBinary, CircleHelp } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Gender } from '../types'

export interface GenderConfig {
  icon: LucideIcon
  label: string
  iconColor: string
  cardBg: string
  avatarBg: string
  // Outline-badge styling (used for relation chips in the person detail sheet).
  badgeClass: string
  // Hex color for the canvas MiniMap, which can't use Tailwind classes.
  minimapColor: string
}

export const genderConfig: Record<Gender, GenderConfig> = {
  male: {
    icon: Mars,
    label: 'Male',
    iconColor: 'text-blue-500',
    cardBg: 'bg-blue-50 border-blue-300 dark:bg-blue-950 dark:border-blue-700',
    avatarBg: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200',
    badgeClass:
      'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-200 dark:hover:bg-blue-900',
    minimapColor: '#93c5fd',
  },
  female: {
    icon: Venus,
    label: 'Female',
    iconColor: 'text-pink-500',
    cardBg: 'bg-pink-50 border-pink-300 dark:bg-pink-950 dark:border-pink-700',
    avatarBg: 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-200',
    badgeClass:
      'border-pink-300 bg-pink-50 text-pink-700 hover:bg-pink-100 dark:border-pink-700 dark:bg-pink-950 dark:text-pink-200 dark:hover:bg-pink-900',
    minimapColor: '#f9a8d4',
  },
  other: {
    icon: NonBinary,
    label: 'Other',
    iconColor: 'text-purple-500',
    cardBg: 'bg-purple-50 border-purple-300 dark:bg-purple-950 dark:border-purple-700',
    avatarBg: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200',
    badgeClass:
      'border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100 dark:border-purple-700 dark:bg-purple-950 dark:text-purple-200 dark:hover:bg-purple-900',
    minimapColor: '#d8b4fe',
  },
  unknown: {
    icon: CircleHelp,
    label: 'Unknown',
    iconColor: 'text-muted-foreground',
    cardBg: 'bg-muted border-border',
    avatarBg: 'bg-muted text-muted-foreground',
    badgeClass: 'border-border bg-muted text-muted-foreground hover:bg-muted/70',
    minimapColor: '#e2e8f0',
  },
}
