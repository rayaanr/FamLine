'use client'

import { ChevronDown, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

// Keep these in sync with PersonNode (gender), CoupleNode (status) and
// ParentChildEdge (parentage) — they mirror the colors used on the canvas.
const genderItems = [
  { label: 'Male', dot: 'bg-blue-400' },
  { label: 'Female', dot: 'bg-pink-400' },
  { label: 'Other', dot: 'bg-purple-400' },
  { label: 'Unknown', dot: 'bg-muted-foreground' },
]

const statusItems = [
  { label: 'Married', dot: 'bg-green-400' },
  { label: 'Partnered', dot: 'bg-blue-400' },
  { label: 'Separated', dot: 'bg-amber-400' },
  { label: 'Divorced', dot: 'bg-red-400' },
]

const lineItems = [
  { label: 'Biological', stroke: '#64748b', dash: undefined },
  { label: 'Adopted', stroke: '#8b5cf6', dash: '6 4' },
  { label: 'Step', stroke: '#f59e0b', dash: '2 6' },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">{children}</div>
    </div>
  )
}

function Row({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex w-7 shrink-0 items-center justify-center">{swatch}</span>
      <span className="text-xs text-foreground">{label}</span>
    </div>
  )
}

export function FamilyTreeLegend() {
  return (
    <Collapsible
      defaultOpen
      className="w-56 overflow-hidden rounded-xl border border-border bg-background/90 shadow-sm backdrop-blur-sm"
    >
      <CollapsibleTrigger className="group flex w-full items-center justify-between gap-2 px-3 py-2 text-xs font-semibold text-foreground">
        <span className="flex items-center gap-1.5">
          <Info className="size-3.5 text-muted-foreground" />
          Legend
        </span>
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-panel-open:rotate-180" />
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="space-y-3 px-3 pb-3">
          <Section title="Person · gender">
            {genderItems.map((g) => (
              <Row
                key={g.label}
                label={g.label}
                swatch={<span className={cn('size-2.5 rounded-full', g.dot)} />}
              />
            ))}
          </Section>

          <Section title="Couple · status">
            {statusItems.map((s) => (
              <Row
                key={s.label}
                label={s.label}
                swatch={
                  <span className="flex size-4 items-center justify-center rounded-full border border-border bg-background">
                    <span className={cn('size-2 rounded-full', s.dot)} />
                  </span>
                }
              />
            ))}
          </Section>

          <Section title="Parentage">
            {lineItems.map((l) => (
              <Row
                key={l.label}
                label={l.label}
                swatch={
                  <svg width="28" height="8" aria-hidden>
                    <line
                      x1="0"
                      y1="4"
                      x2="28"
                      y2="4"
                      stroke={l.stroke}
                      strokeWidth="2"
                      strokeDasharray={l.dash}
                    />
                  </svg>
                }
              />
            ))}
          </Section>

          <p className="border-t border-border pt-2 text-[11px] leading-snug text-muted-foreground">
            Faded cards mark a deceased person.
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
