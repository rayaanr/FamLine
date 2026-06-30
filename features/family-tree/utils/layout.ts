import type { Node, Edge } from "@xyflow/react";
import type { FamilyTree, Person, Couple, ParentChildType } from "../types";

// ── Dimensions & spacing ──────────────────────────────────────────────────────
const PERSON_W = 200;
const PERSON_H = 64;
const COUPLE_W = 40;
const COUPLE_H = 40;
const SPOUSE_GAP = 80; // gap between two partner cards (couple node sits in it)
const SIBLING_GAP = 48; // horizontal gap between sibling subtrees
const ROW_GAP = 110; // vertical gap between generations
const ROOT_GAP = 140; // horizontal gap between separate family trees
const ROW_H = PERSON_H + ROW_GAP;

// Distance from a couple node's center to each partner's card center.
// Partners are kept directly adjacent with the couple node in the gap between.
const PARTNER_OFFSET = PERSON_W / 2 + SPOUSE_GAP / 2;

export type UnknownRelativeKind = "partner" | "parents" | "child";

export interface PersonNodeData extends Record<string, unknown> {
  person: Person;
  onEdit: (id: string) => void;
  onOpenDetails: (id: string) => void;
  onAddSpouse: (id: string) => void;
  onAddChild: (id: string) => void;
  onAddParent: (id: string) => void;
  onAddUnknown: (id: string, kind: UnknownRelativeKind) => void;
  // Set only for single parents who have children (collapse-by-person).
  isCollapsed?: boolean;
  hiddenCount?: number;
  hasChildren?: boolean;
  onToggleCollapse?: (nodeId: string) => void;
  // Married-in family portal: this person married into the bloodline being
  // viewed and has their own (currently hidden) ancestry. Clicking opens it.
  isPortal?: boolean;
  hiddenFamilyCount?: number;
  onOpenFamily?: (personId: string) => void;
}

export interface CoupleNodeData extends Record<string, unknown> {
  couple: Couple;
  onEdit: (id: string) => void;
  isCollapsed: boolean;
  hiddenCount: number;
  hasChildren: boolean;
  onToggleCollapse: (nodeId: string) => void;
}

export type PersonFlowNode = Node<PersonNodeData, "person">;
export type CoupleFlowNode = Node<CoupleNodeData, "couple">;
export type AppNode = PersonFlowNode | CoupleFlowNode;

export type SpouseEdgeData = Record<string, never>;
export interface ParentChildEdgeData extends Record<string, unknown> {
  type: ParentChildType;
}

export type SpouseFlowEdge = Edge<SpouseEdgeData, "spouse">;
export type ParentChildFlowEdge = Edge<ParentChildEdgeData, "parentChild">;
export type AppEdge = SpouseFlowEdge | ParentChildFlowEdge;

export interface NodeCallbacks {
  onEditPerson: (id: string) => void;
  onOpenDetails: (id: string) => void;
  onAddSpouse: (id: string) => void;
  onAddChild: (id: string) => void;
  onAddParent: (id: string) => void;
  onAddUnknown: (id: string, kind: UnknownRelativeKind) => void;
  onEditCouple: (id: string) => void;
  onToggleCollapse: (nodeId: string) => void;
  onOpenFamily: (personId: string) => void;
}

interface Point {
  x: number;
  y: number;
}

export function buildGraphFromTree(
  tree: FamilyTree,
  callbacks: NodeCallbacks,
  collapsed: Set<string> = new Set(),
  focusId: string | null = null,
): { nodes: AppNode[]; edges: AppEdge[] } {
  const { people, couples, parentChildren } = tree;

  if (Object.keys(people).length === 0) return { nodes: [], edges: [] };

  // ── Lookup maps ────────────────────────────────────────────────────────────
  const coupleChildren = new Map<string, string[]>(); // coupleId  → childIds
  const personCouples = new Map<string, string[]>(); // personId  → coupleIds
  const singleParentChildren = new Map<string, string[]>(); // parentId → childIds
  const childHasParents = new Set<string>();

  for (const c of Object.values(couples)) {
    for (const pid of [c.partner1Id, c.partner2Id]) {
      personCouples.set(pid, [...(personCouples.get(pid) ?? []), c.id]);
    }
  }

  for (const pc of Object.values(parentChildren)) {
    if (pc.coupleId && couples[pc.coupleId]) {
      coupleChildren.set(pc.coupleId, [
        ...(coupleChildren.get(pc.coupleId) ?? []),
        pc.childId,
      ]);
      childHasParents.add(pc.childId);
    } else if (pc.singleParentId && people[pc.singleParentId]) {
      singleParentChildren.set(pc.singleParentId, [
        ...(singleParentChildren.get(pc.singleParentId) ?? []),
        pc.childId,
      ]);
      childHasParents.add(pc.childId);
    }
  }

  const childrenOf = (coupleId: string) => coupleChildren.get(coupleId) ?? [];
  const couplesOf = (personId: string) => personCouples.get(personId) ?? [];
  const soleChildrenOf = (personId: string) =>
    singleParentChildren.get(personId) ?? [];
  const otherPartner = (couple: Couple, id: string) =>
    couple.partner1Id === id ? couple.partner2Id : couple.partner1Id;
  const isParentless = (id: string) => !childHasParents.has(id);

  // Walk upward from personId, adding every ancestor (person IDs) to `seen`.
  const collectAncestors = (personId: string, seen: Set<string>): void => {
    for (const pc of Object.values(parentChildren)) {
      if (pc.childId !== personId) continue;
      if (pc.coupleId && couples[pc.coupleId]) {
        const c = couples[pc.coupleId];
        for (const pid of [c.partner1Id, c.partner2Id]) {
          if (!seen.has(pid)) {
            seen.add(pid);
            collectAncestors(pid, seen);
          }
        }
      } else if (pc.singleParentId && people[pc.singleParentId]) {
        if (!seen.has(pc.singleParentId)) {
          seen.add(pc.singleParentId);
          collectAncestors(pc.singleParentId, seen);
        }
      }
    }
  };

  // ── Collapse: a collapsed point lays out as a leaf (no descendants) ──────────
  const coupleCollapsed = (coupleId: string) =>
    collapsed.has(`couple-${coupleId}`);
  const personCollapsed = (personId: string) =>
    collapsed.has(`person-${personId}`);
  const visibleChildrenOf = (coupleId: string) =>
    coupleCollapsed(coupleId) ? [] : childrenOf(coupleId);
  const visibleSoleChildrenOf = (personId: string) =>
    personCollapsed(personId) ? [] : soleChildrenOf(personId);

  // ── Married-in detection & ancestry collapse ─────────────────────────────────
  // A married-in person is one reached through a marriage (placed as a spouse),
  // not by descending the bloodline. Married-in people who carry their own
  // parents are "portals": their ancestry is hidden by default and an icon on
  // their card opens (focuses) that family. Focusing swaps the view entirely.
  const trulyParentless = (id: string) => !childHasParents.has(id);

  // Mirror the placement descent order to classify bloodline vs married-in.
  const visited = new Set<string>();
  const marriedIn = new Set<string>();
  const descend = (id: string): void => {
    if (visited.has(id)) return;
    visited.add(id);
    for (const cid of couplesOf(id)) {
      const sp = otherPartner(couples[cid], id);
      if (!visited.has(sp)) {
        visited.add(sp);
        marriedIn.add(sp); // placed as a flanking spouse, not bloodline
      }
      if (!coupleCollapsed(cid)) for (const ch of childrenOf(cid)) descend(ch);
    }
    if (!personCollapsed(id)) for (const ch of soleChildrenOf(id)) descend(ch);
  };

  // The "family" of a person F when their portal is opened: F's full blood
  // family — ancestors plus everyone descending from those ancestors (siblings,
  // cousins, aunts/uncles…), but pruned AT F so F's own descendants (shared with
  // the spouse they married) stay hidden. F's spouse(s) are kept as leaves and
  // become the portal back to the family they married into. Returns the visible
  // member set and the spouse-leaves that should show a portal icon.
  const computeFocusFamily = (
    F: string,
  ): { fam: Set<string>; portals: Set<string> } => {
    const fam = new Set<string>();
    collectAncestors(F, fam);
    const ancestorsOnly = new Set(fam);
    fam.add(F);
    const spouseLeaves = new Set<string>();
    const expand = (id: string): void => {
      for (const cid of couplesOf(id)) {
        const sp = otherPartner(couples[cid], id);
        if (!fam.has(sp)) {
          fam.add(sp);
          spouseLeaves.add(sp);
        }
        if (!coupleCollapsed(cid))
          for (const ch of childrenOf(cid)) {
            if (fam.has(ch)) continue;
            fam.add(ch);
            if (ch !== F) expand(ch); // prune below F (the other family)
          }
      }
      if (!personCollapsed(id))
        for (const ch of soleChildrenOf(id)) {
          if (fam.has(ch)) continue;
          fam.add(ch);
          if (ch !== F) expand(ch);
        }
    };
    for (const a of ancestorsOnly) expand(a);
    // F's own spouse(s): the bridge leaf/portal back to the other family.
    for (const cid of couplesOf(F)) {
      const sp = otherPartner(couples[cid], F);
      fam.add(sp);
      spouseLeaves.add(sp);
    }
    const portals = new Set<string>();
    for (const sp of spouseLeaves) if (childHasParents.has(sp)) portals.add(sp);
    return { fam, portals };
  };

  // People hidden from layout entirely, and the portal people that show an icon.
  const hidden = new Set<string>();
  const portalPeople = new Set<string>();
  const validFocus = focusId && people[focusId] ? focusId : null;

  if (validFocus) {
    // Swap view: show the focused person's whole family, hide everything else.
    const { fam, portals } = computeFocusFamily(validFocus);
    for (const id of Object.keys(people)) if (!fam.has(id)) hidden.add(id);
    for (const p of portals) portalPeople.add(p);
  } else {
    // Default: establish each connected family's primary bloodline one at a
    // time. After descending a primary, hide the married-in families that hang
    // off it (whole family: ancestors + collateral), so their parentless
    // founders aren't then descended as separate primaries / leaked as strays.
    const hideMarriedIn = () => {
      for (const s of marriedIn) {
        if (portalPeople.has(s) || !childHasParents.has(s)) continue;
        portalPeople.add(s);
        const { fam } = computeFocusFamily(s);
        for (const m of fam) if (m !== s && !visited.has(m)) hidden.add(m);
      }
    };
    // Founding couples first, then any remaining roots — re-scanning after each
    // so newly-hidden in-law founders are skipped.
    const descendNextRoot = (): boolean => {
      for (const c of Object.values(couples)) {
        if (visited.has(c.partner1Id) || visited.has(c.partner2Id)) continue;
        if (hidden.has(c.partner1Id) || hidden.has(c.partner2Id)) continue;
        if (trulyParentless(c.partner1Id) && trulyParentless(c.partner2Id)) {
          descend(c.partner1Id);
          hideMarriedIn();
          return true;
        }
      }
      for (const id of Object.keys(people)) {
        if (visited.has(id) || hidden.has(id) || !trulyParentless(id)) continue;
        descend(id);
        hideMarriedIn();
        return true;
      }
      return false;
    };
    while (descendNextRoot()) {
      /* keep establishing primaries until none remain */
    }
    // Safety net for cycles/orphans — never resurrect a hidden married-in family.
    for (const id of Object.keys(people)) {
      if (visited.has(id) || hidden.has(id)) continue;
      descend(id);
    }
    hideMarriedIn();
  }

  // Number of people hidden when a branch is collapsed (the whole subtree below
  // it). Walks the raw maps; `seen` guards against the rare shared-descendant DAG.
  const countCoupleDescendants = (
    coupleId: string,
    seen: Set<string>,
  ): number => {
    let n = 0;
    for (const childId of childrenOf(coupleId)) {
      if (seen.has(childId)) continue;
      seen.add(childId);
      n += 1;
      for (const cid of couplesOf(childId)) {
        const spouse = otherPartner(couples[cid], childId);
        if (!seen.has(spouse)) {
          seen.add(spouse);
          n += 1;
        }
        n += countCoupleDescendants(cid, seen);
      }
      n += countPersonDescendants(childId, seen);
    }
    return n;
  };
  const countPersonDescendants = (
    personId: string,
    seen: Set<string>,
  ): number => {
    let n = 0;
    for (const childId of soleChildrenOf(personId)) {
      if (seen.has(childId)) continue;
      seen.add(childId);
      n += 1;
      for (const cid of couplesOf(childId)) {
        const spouse = otherPartner(couples[cid], childId);
        if (!seen.has(spouse)) {
          seen.add(spouse);
          n += 1;
        }
        n += countCoupleDescendants(cid, seen);
      }
      n += countPersonDescendants(childId, seen);
    }
    return n;
  };

  // ── Generations via constraint relaxation ──────────────────────────────────
  // Two constraints, relaxed until stable:
  //   • both partners of a couple share a generation (the deeper one wins)
  //   • a child sits one generation below its parents
  // This correctly pulls "married-in" spouses down to their partner's row,
  // instead of stranding them at generation 0 just because they have no parents.
  const generation = new Map<string, number>();
  for (const id of Object.keys(people)) generation.set(id, 0);

  const coupleGen = (c: Couple) =>
    Math.max(
      generation.get(c.partner1Id) ?? 0,
      generation.get(c.partner2Id) ?? 0,
    );

  let changed = true;
  let guard = Object.keys(people).length + Object.keys(couples).length + 2;
  while (changed && guard-- > 0) {
    changed = false;

    for (const c of Object.values(couples)) {
      const g = coupleGen(c);
      if (generation.get(c.partner1Id) !== g) {
        generation.set(c.partner1Id, g);
        changed = true;
      }
      if (generation.get(c.partner2Id) !== g) {
        generation.set(c.partner2Id, g);
        changed = true;
      }
    }

    for (const pc of Object.values(parentChildren)) {
      const parentGen =
        pc.coupleId && couples[pc.coupleId]
          ? coupleGen(couples[pc.coupleId])
          : pc.singleParentId && people[pc.singleParentId]
            ? (generation.get(pc.singleParentId) ?? 0)
            : undefined;
      if (parentGen === undefined) continue;
      if ((generation.get(pc.childId) ?? 0) < parentGen + 1) {
        generation.set(pc.childId, parentGen + 1);
        changed = true;
      }
    }
  }

  // ── Contour-based placement (Reingold–Tilford style) ────────────────────────
  // Each subtree is laid out in local coordinates with its root person's center
  // at x = 0. We track a left/right *contour* (the silhouette: min/max edge per
  // generation row) so siblings are packed by their actual per-row outline, not
  // a bounding box. A leaf sibling therefore tucks in next to its sibling's top
  // row instead of being pushed past that sibling's entire (possibly huge)
  // descendant subtree.
  const personPos = new Map<string, Point>(); // top-left of person nodes
  const couplePos = new Map<string, Point>(); // top-left of couple nodes
  const claimed = new Set<string>(); // a node belongs to exactly one parent

  // A contour maps a generation row → an x edge (min for left, max for right).
  type Contour = Map<number, number>;
  interface PlacedNode {
    id: string;
    cx: number; // center x, relative to this shape's anchor
    row: number; // generation
  }
  interface Shape {
    persons: PlacedNode[];
    couples: PlacedNode[];
    left: Contour; // min left edge per row
    right: Contour; // max right edge per row
  }

  const emptyShape = (): Shape => ({
    persons: [],
    couples: [],
    left: new Map(),
    right: new Map(),
  });

  const addPersonNode = (s: Shape, id: string, cx: number, row: number) => {
    s.persons.push({ id, cx, row });
    s.left.set(row, Math.min(s.left.get(row) ?? Infinity, cx - PERSON_W / 2));
    s.right.set(row, Math.max(s.right.get(row) ?? -Infinity, cx + PERSON_W / 2));
  };
  // Couple nodes sit in the gap between their two partners, so their tiny box is
  // always inside the partners' extent and never widens the contour.
  const addCoupleNode = (s: Shape, id: string, cx: number, row: number) =>
    s.couples.push({ id, cx, row });

  const translateShape = (s: Shape, dx: number): Shape => {
    if (dx === 0) return s;
    const shift = (c: Contour): Contour => {
      const out: Contour = new Map();
      for (const [row, v] of c) out.set(row, v + dx);
      return out;
    };
    return {
      persons: s.persons.map((n) => ({ ...n, cx: n.cx + dx })),
      couples: s.couples.map((n) => ({ ...n, cx: n.cx + dx })),
      left: shift(s.left),
      right: shift(s.right),
    };
  };

  // Minimal rightward shift so `next`'s left contour clears `acc`'s right
  // contour by SIBLING_GAP on every shared row. Siblings always share their own
  // generation row, so this is well-defined.
  const separation = (acc: Contour, next: Contour): number => {
    let dx = -Infinity;
    for (const [row, l] of next) {
      const r = acc.get(row);
      if (r !== undefined) dx = Math.max(dx, r + SIBLING_GAP - l);
    }
    return dx === -Infinity ? 0 : dx;
  };

  // Pack a list of child subtrees left-to-right by contour. Returns the merged
  // shape plus each child root's center (used to center the parent over them).
  const buildShape = (id: string): Shape | null => buildShapeImpl(id);

  function buildBand(childIds: string[]): {
    merged: Shape;
    centers: number[];
  } {
    const merged = emptyShape();
    const centers: number[] = [];
    const accRight: Contour = new Map();
    let first = true;
    for (const cid of childIds) {
      const child = buildShape(cid);
      if (!child) continue; // already claimed elsewhere (shared-descendant DAG)
      const dx = first ? 0 : separation(accRight, child.left);
      const shifted = translateShape(child, dx);
      centers.push(dx); // child root person sits at x = dx (it was at 0 locally)
      merged.persons.push(...shifted.persons);
      merged.couples.push(...shifted.couples);
      for (const [row, v] of shifted.left)
        merged.left.set(row, Math.min(merged.left.get(row) ?? Infinity, v));
      for (const [row, v] of shifted.right) {
        merged.right.set(row, Math.max(merged.right.get(row) ?? -Infinity, v));
        accRight.set(row, Math.max(accRight.get(row) ?? -Infinity, v));
      }
      first = false;
    }
    return { merged, centers };
  }

  // Re-anchor a shape so the root person's center is at x = 0.
  const reanchor = (s: Shape, rootId: string): Shape => {
    const root = s.persons.find((p) => p.id === rootId);
    return root ? translateShape(s, -root.cx) : s;
  };

  // Fold a child band into a shape (the band is already positioned).
  const absorbBand = (s: Shape, band: Shape) => {
    s.persons.push(...band.persons);
    s.couples.push(...band.couples);
    for (const [row, v] of band.left)
      s.left.set(row, Math.min(s.left.get(row) ?? Infinity, v));
    for (const [row, v] of band.right)
      s.right.set(row, Math.max(s.right.get(row) ?? -Infinity, v));
  };

  function buildShapeImpl(id: string): Shape | null {
    if (claimed.has(id) || hidden.has(id)) return null;
    claimed.add(id);

    const g = generation.get(id) ?? 0;
    // Drop couples whose partner is hidden (e.g. a married-in spouse whose own
    // lineage we are focused on, so the bridging partner sits elsewhere).
    const coupleIds = couplesOf(id).filter(
      (cid) => !hidden.has(otherPartner(couples[cid], id)),
    );
    const shape = emptyShape();

    // All descendant blocks below this person, in one band: each couple's
    // visible children (couple order), then this person's sole children.
    const bandChildIds: string[] = [];
    for (const cid of coupleIds) bandChildIds.push(...visibleChildrenOf(cid));
    bandChildIds.push(...visibleSoleChildrenOf(id));
    const visibleBandChildIds = bandChildIds.filter((ch) => !hidden.has(ch));

    const { merged: band, centers } = buildBand(visibleBandChildIds);
    // Anchor the parent over the midpoint of the outermost children.
    const bandAnchor = centers.length
      ? (centers[0] + centers[centers.length - 1]) / 2
      : 0;

    if (coupleIds.length === 0) {
      absorbBand(shape, band);
      addPersonNode(shape, id, bandAnchor, g);
      return reanchor(shape, id);
    }

    if (coupleIds.length === 1) {
      const couple = tree.couples[coupleIds[0]];
      const spouse = otherPartner(couple, id);
      claimed.add(spouse);
      // Couple node centered over the children; partners flank it.
      absorbBand(shape, band);
      addCoupleNode(shape, couple.id, bandAnchor, g);
      addPersonNode(shape, id, bandAnchor - PARTNER_OFFSET, g);
      addPersonNode(shape, spouse, bandAnchor + PARTNER_OFFSET, g);
      return reanchor(shape, id);
    }

    // Multiple marriages — keep the shared person flanked by partners:
    //   [spouse1] ♥ [person] ♥ [spouse2] …
    // The combined children band is centered under the person.
    absorbBand(shape, band);
    addPersonNode(shape, id, bandAnchor, g);

    const c0 = tree.couples[coupleIds[0]];
    const s0 = otherPartner(c0, id);
    claimed.add(s0);
    addCoupleNode(shape, c0.id, bandAnchor - PARTNER_OFFSET, g);
    addPersonNode(shape, s0, bandAnchor - 2 * PARTNER_OFFSET, g);

    let rc = bandAnchor + PARTNER_OFFSET; // first right-hand couple node
    for (let j = 1; j < coupleIds.length; j++) {
      const cj = tree.couples[coupleIds[j]];
      const sj = otherPartner(cj, id);
      claimed.add(sj);
      addCoupleNode(shape, cj.id, rc, g);
      addPersonNode(shape, sj, rc + PARTNER_OFFSET, g);
      rc += 2 * PARTNER_OFFSET + COUPLE_W;
    }

    return reanchor(shape, id);
  }

  // Write a finished shape to absolute coordinates with its left edge at originX.
  // Returns the shape's total width so callers can advance the root cursor.
  const writeShape = (s: Shape, originX: number): number => {
    let minLeft = Infinity;
    let maxRight = -Infinity;
    for (const v of s.left.values()) minLeft = Math.min(minLeft, v);
    for (const v of s.right.values()) maxRight = Math.max(maxRight, v);
    if (!Number.isFinite(minLeft)) minLeft = 0;
    if (!Number.isFinite(maxRight)) maxRight = 0;
    const dx = originX - minLeft;

    for (const p of s.persons) {
      personPos.set(p.id, {
        x: p.cx + dx - PERSON_W / 2,
        y: p.row * ROW_H,
      });
    }
    for (const c of s.couples) {
      couplePos.set(c.id, {
        x: c.cx + dx - COUPLE_W / 2,
        y: c.row * ROW_H + (PERSON_H - COUPLE_H) / 2,
      });
    }
    return maxRight - minLeft;
  };

  // Fold in descendant-collapse: everyone below a collapsed point must not be
  // placed at all (otherwise the safety net would re-add them as stray roots).
  for (const key of collapsed) {
    if (key.startsWith("couple-"))
      countCoupleDescendants(key.slice("couple-".length), hidden);
    else if (key.startsWith("person-"))
      countPersonDescendants(key.slice("person-".length), hidden);
  }

  // ── Choose roots & run placement ────────────────────────────────────────────
  // Founding couples (both partners parentless) anchor whole trees; descend
  // from one partner so the other is placed as a spouse.
  let rootCursor = 0;
  const placeRoot = (id: string) => {
    const shape = buildShape(id);
    if (shape) rootCursor += writeShape(shape, rootCursor) + ROOT_GAP;
  };
  for (const c of Object.values(couples)) {
    if (claimed.has(c.partner1Id) || claimed.has(c.partner2Id)) continue;
    // Skip couples whose partners are hidden ancestors.
    if (hidden.has(c.partner1Id) || hidden.has(c.partner2Id)) continue;
    if (isParentless(c.partner1Id) && isParentless(c.partner2Id)) {
      placeRoot(c.partner1Id);
    }
  }
  // Remaining parentless people: single founders, or spouses not yet reached.
  for (const id of Object.keys(people)) {
    if (claimed.has(id) || hidden.has(id) || !isParentless(id)) continue;
    placeRoot(id);
  }
  // Safety net for anything left (cycles, orphaned records) - but never resurrect
  // people hidden inside a collapsed branch.
  for (const id of Object.keys(people)) {
    if (claimed.has(id) || hidden.has(id)) continue;
    placeRoot(id);
  }

  // ── Build nodes ──────────────────────────────────────────────────────────────
  const nodes: AppNode[] = [];
  const edges: AppEdge[] = [];

  for (const person of Object.values(people)) {
    const pos = personPos.get(person.id);
    if (!pos) continue; // hidden inside a collapsed branch
    const hasSoleKids = soleChildrenOf(person.id).length > 0;
    nodes.push({
      id: `person-${person.id}`,
      type: "person",
      position: pos,
      data: {
        person,
        onEdit: callbacks.onEditPerson,
        onOpenDetails: callbacks.onOpenDetails,
        onAddSpouse: callbacks.onAddSpouse,
        onAddChild: callbacks.onAddChild,
        onAddParent: callbacks.onAddParent,
        onAddUnknown: callbacks.onAddUnknown,
        hasChildren: hasSoleKids,
        isCollapsed: personCollapsed(person.id),
        hiddenCount: hasSoleKids
          ? countPersonDescendants(person.id, new Set([person.id]))
          : 0,
        onToggleCollapse: callbacks.onToggleCollapse,
        isPortal: portalPeople.has(person.id),
        hiddenFamilyCount: portalPeople.has(person.id)
          ? [...computeFocusFamily(person.id).fam].filter(
              (id) => id !== person.id && hidden.has(id),
            ).length
          : 0,
        onOpenFamily: callbacks.onOpenFamily,
      },
    });
  }

  for (const couple of Object.values(couples)) {
    const pos = couplePos.get(couple.id);
    if (!pos) continue;
    const hasKids = childrenOf(couple.id).length > 0;
    nodes.push({
      id: `couple-${couple.id}`,
      type: "couple",
      position: pos,
      data: {
        couple,
        onEdit: callbacks.onEditCouple,
        hasChildren: hasKids,
        isCollapsed: coupleCollapsed(couple.id),
        hiddenCount: hasKids ? countCoupleDescendants(couple.id, new Set()) : 0,
        onToggleCollapse: callbacks.onToggleCollapse,
      },
    });

    // Connect each partner to the couple node from whichever side they sit on.
    const p1 = personPos.get(couple.partner1Id);
    const p2 = personPos.get(couple.partner2Id);
    const p1IsLeft = (p1?.x ?? 0) <= (p2?.x ?? 0);

    edges.push({
      id: `spouse-${couple.id}-p1`,
      type: "spouse",
      source: `person-${couple.partner1Id}`,
      sourceHandle: p1IsLeft ? "spouse-right" : "spouse-left",
      target: `couple-${couple.id}`,
      targetHandle: p1IsLeft ? "left" : "right",
      data: {},
    } as SpouseFlowEdge);

    edges.push({
      id: `spouse-${couple.id}-p2`,
      type: "spouse",
      source: `person-${couple.partner2Id}`,
      sourceHandle: p1IsLeft ? "spouse-left" : "spouse-right",
      target: `couple-${couple.id}`,
      targetHandle: p1IsLeft ? "right" : "left",
      data: {},
    } as SpouseFlowEdge);
  }

  for (const pc of Object.values(parentChildren)) {
    if (!personPos.has(pc.childId)) continue; // child is inside a collapsed branch
    // Also skip when the parent side is hidden (ancestry collapse).
    if (pc.coupleId && !couplePos.has(pc.coupleId)) continue;
    if (pc.singleParentId && !personPos.has(pc.singleParentId)) continue;
    if (pc.coupleId && couples[pc.coupleId]) {
      edges.push({
        id: `parentchild-${pc.id}`,
        type: "parentChild",
        source: `couple-${pc.coupleId}`,
        sourceHandle: "bottom",
        target: `person-${pc.childId}`,
        targetHandle: "top",
        data: { type: pc.type },
      } as ParentChildFlowEdge);
    } else if (pc.singleParentId && people[pc.singleParentId]) {
      edges.push({
        id: `parentchild-${pc.id}`,
        type: "parentChild",
        source: `person-${pc.singleParentId}`,
        sourceHandle: "bottom",
        target: `person-${pc.childId}`,
        targetHandle: "top",
        data: { type: pc.type },
      } as ParentChildFlowEdge);
    }
  }

  // Normalize so the placed graph starts near the origin. Generation rows are
  // absolute (row * ROW_H), so a focused family of deep ancestors would
  // otherwise sit far down/right with empty space above it.
  if (nodes.length > 0) {
    let minX = Infinity;
    let minY = Infinity;
    for (const n of nodes) {
      if (n.position.x < minX) minX = n.position.x;
      if (n.position.y < minY) minY = n.position.y;
    }
    if (minX !== 0 || minY !== 0) {
      for (const n of nodes) {
        n.position = { x: n.position.x - minX, y: n.position.y - minY };
      }
    }
  }

  return { nodes, edges };
}
