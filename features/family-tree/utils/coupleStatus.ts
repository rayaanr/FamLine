import { Heart, HeartCrack, Unlink, HeartHandshake } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { CoupleStatus } from '../types'

export interface CoupleStatusConfig {
  icon: LucideIcon
  color: string
  bg: string
}

export const coupleStatusConfig: Record<CoupleStatus, CoupleStatusConfig> = {
  married:   { icon: Heart,          color: 'text-red-500',   bg: 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900' },
  partnered: { icon: HeartHandshake, color: 'text-blue-500',  bg: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900' },
  separated: { icon: Unlink,         color: 'text-amber-500', bg: 'bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900' },
  divorced:  { icon: HeartCrack,     color: 'text-slate-400', bg: 'bg-slate-100 border-slate-300 dark:bg-slate-800/40 dark:border-slate-600' },
}
