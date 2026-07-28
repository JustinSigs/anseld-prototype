// ============================================================
// The nights of Gullshead. Three visitations, each with a
// learnable rule and (for two of them) a prevention lever.
// The ghosts are never funny. Everyone's reaction to them is.
// ============================================================

import { LOTS, WALKER_ROUTE, placeById } from './world';

export type EventKind = 'choir' | 'walker' | 'weeping';

export interface NightEvent {
  kind: EventKind;
  label: string; // what a scared tourist says they saw
  /** Active window, hours (fractional ok). */
  startHour: number;
  endHour: number;
  /** For weeping: which lot. */
  lotId?: string;
}

/** Fog is seeded per day: learnable-ish, not random-feeling. */
export function isFoggy(day: number): boolean {
  return ((day * 2654435761) >>> 0) % 10 < 4;
}

/**
 * What tonight holds. Precedence: the Walker keeps its calendar,
 * the Choir needs fog, the Weeping House takes the leftover nights.
 */
export function eventForNight(day: number): NightEvent {
  if (day % 3 === 0) {
    return { kind: 'walker', label: 'a lantern walking the north lane with nobody carrying it', startHour: 22.5, endHour: 24.5 };
  }
  if (isFoggy(day)) {
    return { kind: 'choir', label: 'pale figures rising from the water, singing', startHour: 22.5, endHour: 26 };
  }
  const ruined = LOTS[(day * 7) % LOTS.length];
  return {
    kind: 'weeping',
    label: `a building sobbing and leaking fog (${ruined.name})`,
    startHour: 23,
    endHour: 27,
    lotId: ruined.id,
  };
}

/** Where the event manifests at a given hour (for rendering + witness radius). */
export function eventPosition(ev: NightEvent, hourF: number): { x: number; y: number } {
  // Normalize hours past midnight (e.g. 26 = 02:00).
  const h = hourF < 12 ? hourF + 24 : hourF;
  switch (ev.kind) {
    case 'choir':
      return { x: placeById('beach-water').x, y: placeById('beach-water').y };
    case 'walker': {
      const t = Math.max(0, Math.min(1, (h - ev.startHour) / (ev.endHour - ev.startHour)));
      const idx = Math.min(WALKER_ROUTE.length - 1, Math.floor(t * WALKER_ROUTE.length));
      return WALKER_ROUTE[idx];
    }
    case 'weeping': {
      const lot = LOTS.find((l) => l.id === ev.lotId) ?? LOTS[0];
      return { x: lot.doorX, y: lot.doorY - 1 };
    }
  }
}

export interface Levers {
  bellRungThisEvening: boolean;
  saltLineLaid: boolean;
}

/** Does tonight's event actually manifest, given the mayor's preparations? */
export function eventPrevented(ev: NightEvent, levers: Levers): { prevented: boolean; note: string } {
  if (ev.kind === 'choir' && levers.bellRungThisEvening) {
    return { prevented: true, note: 'The old bell was rung before nine. The water stays quiet tonight — the choir only wanted to be remembered.' };
  }
  if (ev.kind === 'walker' && levers.saltLineLaid) {
    return { prevented: true, note: 'The lantern reaches the salt line, considers it, and goes home. It is not proud.' };
  }
  return { prevented: false, note: '' };
}

/** The Walker halts at the salt line if laid (visual: it never passes x=20). */
export function walkerHaltsAt(): number {
  return 20;
}

/** Curse journal pages, earned by the mayor witnessing things up close. */
export const CURSE_PAGES: Record<EventKind, { title: string; text: string }> = {
  choir: {
    title: 'The Drowned Choir',
    text: 'They rise on fog nights and sing at the beach — the same six voices, always. They rose the year the chapel bell went quiet. Maren says they keep to the bottom if the bell is rung before nine. They want to be remembered. That is all most things want.',
  },
  walker: {
    title: 'The Lantern Walker',
    text: 'Every third night, a lantern walks the north lane from the chapel ruin to the lighthouse, carried by no hand. It will not cross salt. It walks toward the light because the light is the only thing on this island older than it is.',
  },
  weeping: {
    title: 'The Weeping House',
    text: 'On the leftover nights, one of the ruins weeps — sobbing in the walls, fog through the boards. It favors the buildings nobody has loved lately. Hobb swears the crying stopped while he measured for repairs. Perhaps it only wants what the whole island wants: fixing.',
  },
};
