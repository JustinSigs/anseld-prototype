// ============================================================
// The Referee — pure code, no AI, no judgment calls.
// Owns: possession legality, rewind pricing (one scar, always),
// unwitnessed marking, prophecy contacts and decay, aiming,
// win/loss. The storyteller is never asked to remember a rule.
// ============================================================

import { GameRecord, deriveState } from './record';
import type { Dials, EraSheet, Fact, Prophecy, StorytellerTurn, WorldState } from './types';

export type EntryClass =
  | { type: 'fresh' }
  | { type: 'rewind-window'; anchorSeq: number; warning: string }
  | { type: 'rewind-dead-host'; anchorSeq: number; warning: string }
  | { type: 'illegal'; reason: string };

export class Referee {
  constructor(
    public record: GameRecord,
    public sheet: EraSheet,
    public dials: Dials,
  ) {}

  state(): WorldState {
    return deriveState(this.record, this.sheet, this.dials);
  }

  hostById(id: string) {
    return this.sheet.hosts.find((h) => h.id === id);
  }

  locationById(id: string) {
    return this.sheet.locations.find((l) => l.id === id);
  }

  /** Law of the Open Door: the player is warned, every time, before a priced entry. */
  classifyEntry(hostId: string, year: number): EntryClass {
    const host = this.hostById(hostId);
    if (!host) return { type: 'illegal', reason: 'No such person exists in this era.' };
    if (year < this.sheet.eraStart || year > this.sheet.eraEnd)
      return { type: 'illegal', reason: `The telling holds Years ${this.sheet.eraStart}–${this.sheet.eraEnd}.` };
    if (year < host.birthYear)
      return { type: 'illegal', reason: `${host.name} is not yet born in Year ${year}.` };
    if (year > host.deathYear)
      return { type: 'illegal', reason: `${host.name} is dead by Year ${year}. No body, no entry — the Law of Flesh holds.` };

    // Re-entering a window you already occupied — 4a. One scar.
    const windows = this.record.occupiedWindows();
    const match = windows.find((w) => w.hostId === hostId && w.year === year);
    if (match) {
      const anchor = this.findWindowAnchor(hostId, year);
      return {
        type: 'rewind-window',
        anchorSeq: anchor,
        warning:
          'You have stood in this moment before. Returning un-happens everything since — but the Ledger does not un-count what it counted. This will leave a scar.',
      };
    }

    // Re-entering a host you have watched die — 4b. One scar. No longer free.
    if (this.record.deadHosts().has(hostId)) {
      const anchor = this.findDeathAnchor(hostId);
      return {
        type: 'rewind-dead-host',
        anchorSeq: anchor,
        warning: `${host.name} has died in your telling. Entering them again rewrites their thread from Year ${year}. Everything since their death un-happens — and this will leave a scar.`,
      };
    }

    return { type: 'fresh' };
  }

  private findWindowAnchor(hostId: string, year: number): number {
    for (const e of this.record.live()) {
      if ((e.kind === 'possess' || e.kind === 'turn') && e.hostId === hostId && e.year === year) return e.seq;
    }
    throw new Error('window anchor not found');
  }

  private findDeathAnchor(hostId: string): number {
    for (const e of this.record.live()) {
      if (e.kind === 'host-died' && e.hostId === hostId) return e.seq;
    }
    throw new Error('death anchor not found');
  }

  /** Free movement: exit current host (free — the wake is not), jump, possess fresh. */
  possessFresh(hostId: string, year: number): void {
    const s = this.state();
    if (s.currentHostId) {
      this.record.append({ kind: 'exit-host', year: s.year, hostId: s.currentHostId });
    }
    if (year !== s.year) {
      this.record.append({ kind: 'jump', fromYear: s.year, toYear: year });
    }
    this.record.append({ kind: 'possess', year, hostId });
  }

  /**
   * Execute a priced rewind (either mode). One scar, always.
   * Un-happens play after the anchor; marks the overwritten stretch unwitnessed.
   */
  executeRewind(entry: Extract<EntryClass, { type: 'rewind-window' | 'rewind-dead-host' }>, hostId: string, year: number): void {
    const before = this.state();
    const span = this.record.markUnmadeAfter(entry.anchorSeq);

    this.record.append({
      kind: 'rewind',
      toSeq: entry.anchorSeq,
      fromYear: before.year,
      toYear: year,
      mode: entry.type === 'rewind-window' ? 'window' : 'dead-host',
    });
    this.record.append({
      kind: 'scar',
      year,
      note:
        entry.type === 'rewind-window'
          ? `A folio numbered for a page with nothing on it, Year ${year}.`
          : `A thread rewritten from Year ${year}. The count does not close.`,
    });

    // Overwritten time is recorded as unwitnessed — a fact, not a cost.
    if (entry.type === 'rewind-dead-host') {
      const host = this.hostById(hostId)!;
      const deathYear = Math.min(host.deathYear, this.sheet.eraEnd);
      this.record.append({ kind: 'unwitnessed', fromYear: year, toYear: Math.max(year, deathYear) });
      this.record.append({ kind: 'possess', year, hostId });
    } else {
      const from = span ? Math.min(span.fromYear, year) : year;
      const to = span ? Math.max(span.toYear, before.year) : before.year;
      this.record.append({ kind: 'unwitnessed', fromYear: from, toYear: Math.max(from, to) });
      // The anchor possess/turn event is live again; the player stands in the old window.
    }
  }

  /** Sealed rooms admit only animal hosts. */
  canEnterLocation(hostId: string, locationId: string): { ok: boolean; reason?: string } {
    const host = this.hostById(hostId);
    const loc = this.locationById(locationId);
    if (!host || !loc) return { ok: false, reason: 'Unknown host or place.' };
    if (loc.sealed && host.species === 'human')
      return { ok: false, reason: `${loc.name} is sealed. No human host passes. A smaller body might.` };
    return { ok: true };
  }

  /**
   * Commit a storyteller turn to the Record and run all mechanical consequences:
   * knowledge, death, prophecy contacts (warn → decay per dial).
   * Returns prophecies that need a Clerk ruling (aimed/prime touched by facts).
   */
  ingestTurn(params: { year: number; hostId: string; playerAction: string; turn: StorytellerTurn }): {
    contacts: Array<{ prophecy: Prophecy; result: 'warned' | 'decayed' }>;
    clerkChecks: Prophecy[];
  } {
    const { year, hostId, playerAction, turn } = params;

    this.record.append({
      kind: 'turn',
      year,
      hostId,
      playerAction,
      facts: turn.facts,
      foreclosed: turn.foreclosed,
      prose: turn.prose,
    });

    for (const k of turn.knowledgeGained ?? []) {
      this.record.append({ kind: 'knowledge', text: k });
    }
    if (turn.hostDied) {
      this.record.append({ kind: 'host-died', year, hostId, cause: turn.hostDied.cause });
    }

    const factTags = new Set(turn.facts.flatMap((f) => f.tags.map((t) => t.toLowerCase())));
    const s = this.state(); // includes the turn just committed
    const contacts: Array<{ prophecy: Prophecy; result: 'warned' | 'decayed' }> = [];
    const clerkChecks: Prophecy[] = [];

    for (const p of s.prophecies) {
      const touched = p.tags.some((t) => factTags.has(t.toLowerCase()));
      if (!touched) continue;

      if (p.kind === 'loose' && (p.state === 'unaimed' || p.state === 'warned')) {
        // Decay on contact: warn first, lock at the dialed threshold.
        const result = p.contacts + 1 >= this.dials.contactsToDecay ? 'decayed' : 'warned';
        this.record.append({ kind: 'prophecy-contact', prophecyId: p.id, result });
        contacts.push({ prophecy: p, result });
      } else if (p.state === 'aimed' || p.kind === 'prime') {
        if (p.state !== 'fulfilled' && p.state !== 'spent' && p.state !== 'decayed') {
          clerkChecks.push(p);
        }
      }
    }

    return { contacts, clerkChecks };
  }

  /** Aiming: fills every blank, in the player's words, once, irrevocably. */
  aimProphecy(prophecyId: string, declaration: string, bindings: Record<string, string>): { ok: boolean; reason?: string } {
    const s = this.state();
    const p = s.prophecies.find((x) => x.id === prophecyId);
    if (!p) return { ok: false, reason: 'No such prophecy.' };
    if (p.kind === 'prime') return { ok: false, reason: 'The prime prophecy is not yours to aim. It is the door itself.' };
    if (p.state !== 'unaimed' && p.state !== 'warned')
      return { ok: false, reason: `That prophecy is ${p.state}. Aimed words do not come back.` };
    for (const role of p.roles) {
      if (!bindings[role.label] || !bindings[role.label].trim())
        return { ok: false, reason: `Every blank must be named. "${role.label}" is still empty.` };
    }
    this.record.append({ kind: 'prophecy-aimed', prophecyId, declaration, bindings });
    return { ok: true };
  }

  /** Record a Clerk ruling of fulfilled. (Negative rulings write nothing.) */
  recordFulfillment(prophecyId: string, ruling: string): void {
    this.record.append({ kind: 'prophecy-fulfilled', prophecyId, ruling });
  }

  /** Designer override: return a prophecy to its birth state. Playtest repair, not play. */
  resetProphecy(prophecyId: string, note: string): void {
    this.record.append({ kind: 'prophecy-reset', prophecyId, note });
  }

  /** After any mutation: if the run just ended, write it into the Ledger once. */
  checkEnd(): WorldState {
    const s = this.state();
    const alreadyEnded = this.record.live().some((e) => e.kind === 'run-ended');
    if (s.outcome !== 'playing' && !alreadyEnded) {
      this.record.append({ kind: 'run-ended', outcome: s.outcome === 'won' ? 'won' : 'lost', note: s.outcomeNote });
    }
    return this.state();
  }

  /** Storyteller directives derived from scar tier — the teeth, scaled by the dial. */
  osricDirectives(): string[] {
    const s = this.state();
    const out: string[] = [];
    const intensity = this.dials.osricIntensity;
    if (s.tier >= 2) {
      out.push(
        `SCAR TIER 2 — Osric has localised. Audits cluster on the years and rooms the player has worked in. Watched hosts: ${
          s.hosts.filter((h) => h.watched).map((h) => h.name).join(', ') || 'none yet'
        }. Actions taken through watched hosts may be reported to the Assize.`,
      );
    }
    if (s.tier >= 3) {
      out.push(
        'SCAR TIER 3 — Osric no longer seeks a cause; he seeks a pattern. He pre-positions. At least one avenue the player would want this scene should already be closed, quietly, before they arrive.',
      );
    }
    if (out.length > 0) {
      out.push(
        `Osric involvement intensity: ${intensity}/3. ${
          intensity === 0
            ? 'Keep him a distant auditor — effects only, never presence.'
            : intensity === 1
              ? 'His attention shows in documents and clerks, not in person.'
              : intensity === 2
                ? 'His agents appear in scenes. Sentences aimed past the host may occur.'
                : 'He acts through the Assize with open intent. His marginalia may be found.'
        }`,
      );
    }
    return out;
  }
}

/** Convenience: do a fact's tags touch a prophecy? Exposed for tests. */
export function factsTouch(facts: Fact[], prophecy: Prophecy): boolean {
  const tags = new Set(facts.flatMap((f) => f.tags.map((t) => t.toLowerCase())));
  return prophecy.tags.some((t) => tags.has(t.toLowerCase()));
}
