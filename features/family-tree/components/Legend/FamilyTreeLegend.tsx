"use client";

import { ChevronDown, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { coupleStatusConfig } from "../../utils/coupleStatus";
import { genderConfig } from "../../utils/genderConfig";
import type { CoupleStatus, Gender } from "../../types";

const genderItems: { label: string; gender: Gender }[] = [
  { label: "Male",    gender: "male" },
  { label: "Female",  gender: "female" },
  { label: "Other",   gender: "other" },
  { label: "Unknown", gender: "unknown" },
];

const statusItems: { label: string; status: CoupleStatus }[] = [
  { label: "Married",   status: "married" },
  { label: "Partnered", status: "partnered" },
  { label: "Separated", status: "separated" },
  { label: "Divorced",  status: "divorced" },
];

const lineItems = [
  { label: "Biological", stroke: "#64748b", dash: undefined },
  { label: "Adopted", stroke: "#8b5cf6", dash: "6 4" },
  { label: "Step", stroke: "#f59e0b", dash: "2 6" },
];

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">{children}</div>
    </div>
  );
}

function Row({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex w-7 shrink-0 items-center justify-center">
        {swatch}
      </span>
      <span className="text-xs text-foreground">{label}</span>
    </div>
  );
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
            {genderItems.map(({ label, gender }) => {
              const cfg = genderConfig[gender];
              return (
                <Row
                  key={gender}
                  label={label}
                  swatch={<cfg.icon className={cn("size-3.5", cfg.iconColor)} />}
                />
              );
            })}
          </Section>

          <Section title="Couple · status">
            {statusItems.map(({ label, status }) => {
              const cfg = coupleStatusConfig[status];
              return (
                <Row
                  key={status}
                  label={label}
                  swatch={
                    <span className={cn("flex size-5 items-center justify-center rounded-full border", cfg.bg)}>
                      <cfg.icon
                        className={cn("size-3", cfg.color)}
                        fill="none"
                        strokeWidth={1.75}
                      />
                    </span>
                  }
                />
              );
            })}
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
          <ul className="list-disc border-t border-border pt-2 pl-2 space-y-[0.5] text-[10px] leading-snug text-muted-foreground">
            <li>Faded cards mark a deceased person</li>
            <li>Dashed cards are unknown placeholders that still need details</li>
            <li>Click a card to view details</li>
            <li>Use <span className="font-medium text-foreground">+</span> to add a relative (known or unknown)</li>
          </ul>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
