// ============================================================
// The Record — Anseld's Ledger.
// Append-only. Nothing is ever deleted. A rewind marks events
// "unmade": they stop counting toward the world, but the pages
// stay numbered (scars, knowledge, unwitnessed marks persist).
// ============================================================

import type { Dials, EraSheet, GameEvent, Prophecy, ScarTier, WorldState } from './types';

/** Event kinds that survive a rewind untouched — the permanent ink.
 *  Sealed facts are truths about the world; rewinding your acts does not unmake truth. */
const PERMANENT_KINDS = new Set(['scar', 'unwitnessed', 'knowledge', 'rewind', 'run-started', 'run-ended', 'sealed-fact']);

export class GameRecord {
  private events: GameEvent[] = [];
  private nextSeq = 1;

  append<E extends Omit<GameEvent, 'seq'>>(event: E): GameEvent {
    const full = { ...(event as object), seq: this.nextSeq++ } as GameEvent;
    this.events.push(full);
    return full;
  }

  all(): readonly GameEvent[] {
    return this.events;
  }

  /** Events that still count toward the world (not unmade). */
  live(): GameEvent[] {
    return this.events.filter((e) => !('unmade' in e && e.unmade));
  }

  /**
   * Mark every unmakeable event after `toSeq` as unmade.
   * Returns the world-year span of the unmade turns (for unwitnessed marking),
   * or null if no turns were unmade.
   */
  markUnmadeAfter(toSeq: number): { fromYear: number; toYear: number } | null {
    let minYear = Infinity;
    let maxYear = -Infinity;
    for (const e of this.events) {
      if (e.seq <= toSeq) continue;
      if (PERMANENT_KINDS.has(e.kind)) continue;
      (e as { unmade?: boolean }).unmade = true;
      if (e.kind === 'turn') {
        minYear = Math.min(minYear, e.year);
        maxYear = Math.max(maxYear, e.year);
      }
    }
    if (minYear === Infinity) return null;
    return { fromYear: minYear, toYear: maxYear };
  }

  /** Windows (hostId, year) the player has occupied, live events only. */
  occupiedWindows(): Array<{ hostId: string; year: number }> {
    const seen = new Set<string>();
    const out: Array<{ hostId: string; year: number }> = [];
    for (const e of this.live()) {
      let hostId: string | undefined;
      let year: number | undefined;
      if (e.kind === 'possess' || e.kind === 'turn') {
        hostId = e.hostId;
        year = e.year;
      }
      if (hostId !== undefined && year !== undefined) {
        const key = `${hostId}@${year}`;
        if (!seen.has(key)) {
          seen.add(key);
          out.push({ hostId, year });
        }
      }
    }
    return out;
  }

  /** Host ids whose death the player has witnessed (live events). */
  deadHosts(): Set<string> {
    const dead = new Set<string>();
    for (const e of this.live()) {
      if (e.kind === 'host-died') dead.add(e.hostId);
    }
    return dead;
  }

  serialize(): string {
    return JSON.stringify({ events: this.events, nextSeq: this.nextSeq });
  }

  static deserialize(json: string): GameRecord {
    const r = new GameRecord();
    const data = JSON.parse(json);
    r.events = data.events;
    r.nextSeq = data.nextSeq;
    return r;
  }
}

export function tierFor(scars: number, dials: Dials): ScarTier {
  if (scars >= dials.tier3At) return 3;
  if (scars >= dials.tier2At) return 2;
  return 1;
}

/** Fold the Record into the current world state. Pure function. */
export function deriveState(record: GameRecord, sheet: EraSheet, dials: Dials): WorldState {
  // Prophecies start from their birth state on the era sheet.
  const prophecies: Prophecy[] = [...sheet.primeConditions, ...sheet.looseProphecies].map((p) => ({
    ...p,
    roles: p.roles.map((r) => ({ ...r })),
    state: p.kind === 'prime' ? 'unaimed' : 'unaimed',
    contacts: 0,
    aimDeclaration: null,
  })) as Prophecy[];
  const byId = new Map(prophecies.map((p) => [p.id, p]));

  const state: WorldState = {
    year: sheet.eraStart,
    currentHostId: null,
    scars: 0,
    tier: 1,
    prophecies,
    hosts: sheet.hosts.map((h) => ({ ...h, watched: false })),
    facts: [],
    knowledge: [],
    sealedFacts: [],
    ripples: [],
    unwitnessed: [],
    outcome: 'playing',
    outcomeNote: '',
  };

  const actedLocations = new Set<string>();

  for (const e of record.all()) {
    const unmade = 'unmade' in e && e.unmade;
    switch (e.kind) {
      case 'run-started':
        state.year = e.year;
        break;
      case 'scar':
        state.scars += 1;
        break;
      case 'unwitnessed':
        state.unwitnessed.push({ fromYear: e.fromYear, toYear: e.toYear });
        break;
      case 'knowledge':
        state.knowledge.push(e.text);
        break;
      case 'sealed-fact':
        state.sealedFacts.push({ text: e.text, knownTo: e.knownTo });
        break;
      case 'ripple-opened':
        if (!unmade) state.ripples.push({ id: e.rippleId, text: e.text, year: e.year });
        break;
      case 'ripple-closed':
        if (!unmade) state.ripples = state.ripples.filter((r) => r.id !== e.rippleId);
        break;
      case 'settling':
        if (!unmade) state.facts.push(...e.facts);
        break;
      case 'possess':
        if (!unmade) {
          state.currentHostId = e.hostId;
          state.year = e.year;
        }
        break;
      case 'exit-host':
        if (!unmade) state.currentHostId = null;
        break;
      case 'jump':
        if (!unmade) state.year = e.toYear;
        break;
      case 'turn':
        // Worked locations count even when unmade: audits cluster where
        // the scar happened, though the act itself un-happened.
        for (const f of e.facts) actedLocations.add(f.locationId);
        if (!unmade) {
          state.facts.push(...e.facts);
          state.year = e.year;
          state.currentHostId = e.hostId;
        }
        break;
      case 'host-died':
        if (!unmade && state.currentHostId === e.hostId) state.currentHostId = null;
        break;
      case 'rewind': {
        // The rewind itself repositions the player at the target window.
        // (The scar and unwitnessed entries ride alongside as their own events.)
        state.year = e.toYear;
        break;
      }
      case 'prophecy-contact': {
        if (unmade) break;
        const p = byId.get(e.prophecyId);
        if (!p) break;
        p.contacts += 1;
        if (e.result === 'warned') p.state = 'warned';
        if (e.result === 'decayed') p.state = 'decayed';
        break;
      }
      case 'prophecy-aimed': {
        if (unmade) break;
        const p = byId.get(e.prophecyId);
        if (!p) break;
        p.state = 'aimed';
        p.aimDeclaration = e.declaration;
        for (const role of p.roles) {
          if (e.bindings[role.label] !== undefined) {
            role.boundTo = e.bindings[role.label];
            role.penciled = false;
          }
        }
        break;
      }
      case 'prophecy-fulfilled': {
        if (unmade) break;
        const p = byId.get(e.prophecyId);
        if (!p) break;
        p.state = 'fulfilled';
        break;
      }
      case 'prophecy-reset': {
        // Designer override: return the prophecy to its birth state.
        if (unmade) break;
        const p = byId.get(e.prophecyId);
        if (!p) break;
        p.state = 'unaimed';
        p.contacts = 0;
        p.aimDeclaration = null;
        for (const role of p.roles) {
          role.boundTo = null;
          role.penciled = false;
        }
        break;
      }
      case 'run-ended':
        state.outcome = e.outcome === 'won' ? 'won' : 'lost';
        state.outcomeNote = e.note;
        break;
    }
  }

  state.tier = tierFor(state.scars, dials);

  // Tier 2+: hosts whose home is anywhere the player has worked arrive watched.
  if (state.tier >= 2) {
    for (const h of state.hosts) {
      if (actedLocations.has(h.homeLocation)) h.watched = true;
    }
  }

  // Loss: the scar cap is the only loss.
  if (state.outcome === 'playing' && state.scars >= dials.scarCap) {
    state.outcome = 'lost';
    state.outcomeNote = 'The tally closed on you. Osric stopped seeking a cause and found a pattern.';
  }

  // Win: every prime condition ruled fulfilled.
  if (state.outcome === 'playing') {
    const prime = state.prophecies.filter((p) => p.kind === 'prime');
    if (prime.length > 0 && prime.every((p) => p.state === 'fulfilled')) {
      state.outcome = 'won';
      state.outcomeNote = 'All conditions stand. The prime prophecy is complete.';
    }
  }

  return state;
}
