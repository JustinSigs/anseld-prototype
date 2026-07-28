// ============================================================
// The books: treasury, satisfaction, reputation, and the
// Mainland Gazette — where every departing tourist files the
// review that decides tomorrow's ferry load.
// ============================================================

import type { WantKind } from './world';

export const WANT_LABEL: Record<WantKind, string> = {
  food: 'a good meal',
  fun: 'a bit of fun',
  history: 'some history',
  rest: 'a proper rest',
};

export interface TouristOutcome {
  name: string;
  temper: string;
  wants: WantKind[];
  wantsMet: WantKind[];
  scared: boolean;
  sleptRough: boolean;
  scaredBy?: string; // event label, for the review's specifics
}

export function starsFor(t: TouristOutcome): number {
  if (t.scared) return 1;
  let stars = 2 + t.wantsMet.length * 1.5 - (t.wants.length - t.wantsMet.length) * 1 - (t.sleptRough ? 0.5 : 0);
  return Math.max(1, Math.min(5, Math.round(stars)));
}

/** Rolling reputation: yesterday carries weight, but reviews move it. */
export function nextReputation(current: number, todaysStars: number[]): number {
  if (todaysStars.length === 0) return Math.max(0, current - 0.15); // silence is its own review
  const avg = todaysStars.reduce((a, b) => a + b, 0) / todaysStars.length;
  return Math.max(0, Math.min(5, current * 0.65 + avg * 0.35));
}

export function arrivalsFor(reputation: number): number {
  if (reputation < 0.8) return 0; // the ferry stops coming
  return Math.max(1, Math.min(7, Math.round(reputation * 1.4)));
}

/** Coin earned when a tourist's want is satisfied at an open lot. */
export const COIN_PER_WANT = 6;

// ---------------- Reviews (the Gazette) ----------------

const GOOD_OPENERS = ['Charming little island.', 'Better than advertised, which was nothing.', 'A restorative visit.', 'Quaint. I mean that mostly kindly.'];
const MID_OPENERS = ['An island of contrasts.', 'Fine, I suppose.', 'It’s certainly an island.'];
const SCARED_OPENERS = ['NEVER AGAIN.', 'I want to speak to whoever manages this island. Oh. The mayor. I want to speak to him anyway.', 'I am writing this from under a blanket on the mainland.'];

export function mockReview(t: TouristOutcome): { stars: number; text: string } {
  const stars = starsFor(t);
  if (t.scared) {
    const what = t.scaredBy ?? 'something I refuse to describe';
    return {
      stars,
      text: `${pick(SCARED_OPENERS, t.name.length)} ${cap(what)} — at NIGHT, unadvertised. The chowder does not make up for it. One star. — ${t.name}`,
    };
  }
  const met = t.wantsMet.map((w) => WANT_LABEL[w]).join(' and ');
  const missed = t.wants.filter((w) => !t.wantsMet.includes(w)).map((w) => WANT_LABEL[w]).join(' and ');
  const opener = stars >= 4 ? pick(GOOD_OPENERS, t.name.length) : pick(MID_OPENERS, t.name.length);
  let body = met ? ` Found ${met}.` : ' Found very little open, frankly.';
  if (missed) body += ` Came wanting ${missed}; left still wanting.`;
  if (t.sleptRough) body += ' Slept on a bench. The bench was fine. The principle wasn’t.';
  return { stars, text: `${opener}${body} ${stars} star${stars === 1 ? '' : 's'}. — ${t.name}` };
}

function pick<T>(arr: T[], n: number): T {
  return arr[Math.abs(n) % arr.length];
}
function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
