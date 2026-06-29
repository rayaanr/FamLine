import { Mars, Venus, NonBinary, CircleHelp } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Gender } from '../types'

export interface GenderConfig {
  icon: LucideIcon
  iconColor: string
  cardBg: string
  avatarBg: string
}

export const genderConfig: Record<Gender, GenderConfig> = {
  male: {
    icon: Mars,
    iconColor: 'text-blue-500',
    cardBg: 'bg-blue-50 border-blue-300 dark:bg-blue-950 dark:border-blue-700',
    avatarBg: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200',
  },
  female: {
    icon: Venus,
    iconColor: 'text-pink-500',
    cardBg: 'bg-pink-50 border-pink-300 dark:bg-pink-950 dark:border-pink-700',
    avatarBg: 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-200',
  },
  other: {
    icon: NonBinary,
    iconColor: 'text-purple-500',
    cardBg: 'bg-purple-50 border-purple-300 dark:bg-purple-950 dark:border-purple-700',
    avatarBg: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-200',
  },
  unknown: {
    icon: CircleHelp,
    iconColor: 'text-muted-foreground',
    cardBg: 'bg-muted border-border',
    avatarBg: 'bg-muted text-muted-foreground',
  },
}
