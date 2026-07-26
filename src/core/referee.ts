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

  /** Free movement: exit current host (free — the wake is not), jump, possess fresh.
   *  Returns what the new body's memory yielded. */
  possessFresh(hostId: string, year: number): string[] {
    const s = this.state();
    if (s.currentHostId) {
      const left = this.hostById(s.currentHostId);
      // The wake is not free: an exited host is a thread left running.
      this.record.append({ kind: 'exit-host', year: s.year, hostId: s.currentHostId });
      this.record.append({
        kind: 'ripple-opened',
        rippleId: `r-exit-${s.currentHostId}-y${s.year}`,
        text: `${left?.name ?? s.currentHostId} continues from Year ${s.year} as whoever you left them as, unsteered.`,
        year: s.year,
      });
    }
    if (year !== s.year) {
      this.record.append({ kind: 'jump', fromYear: s.year, toYear: year });
    }
    this.record.append({ kind: 'possess', year, hostId });
    return this.grantHostMemory(hostId);
  }

  /** Knowledge is the player's; while worn, the body's secrets are readable.
   *  Sealed facts known to this host become the player's knowledge, permanently. */
  grantHostMemory(hostId: string): string[] {
    const host = this.hostById(hostId);
    if (!host) return [];
    const s = this.state();
    const gained: string[] = [];
    for (const sf of s.sealedFacts) {
      const knows = sf.knownTo.some(
        (k) => k.toLowerCase() === host.name.toLowerCase() || k.toLowerCase() === host.id.toLowerCase(),
      );
      if (!knows) continue;
      const asKnowledge = `${host.name} knows: ${sf.text}`;
      if (!s.knowledge.includes(asKnowledge)) {
        this.record.append({ kind: 'knowledge', text: asKnowledge });
        gained.push(asKnowledge);
      }
    }
    return gained;
  }

  /** Latest in-world year the telling has reached (live events only). */
  latestPlayedYear(): number {
    let max = this.sheet.eraStart;
    for (const e of this.record.live()) {
      if (e.kind === 'turn' || e.kind === 'possess') max = Math.max(max, e.year);
      if (e.kind === 'settling') max = Math.max(max, e.toYear);
    }
    return max;
  }

  /** Commit a settlement: the gap's reckoning, ripple closures, new truths. */
  commitSettlement(fromYear: number, toYear: number, settlement: import('./types').Settlement): void {
    this.record.append({
      kind: 'settling',
      fromYear,
      toYear,
      chronicle: settlement.chronicle,
      facts: settlement.facts,
    });
    const open = new Set(this.state().ripples.map((r) => r.id));
    for (const res of settlement.rippleResolutions) {
      if (open.has(res.rippleId)) {
        this.record.append({ kind: 'ripple-closed', rippleId: res.rippleId, resolution: res.resolution });
      }
    }
    for (const sf of settlement.sealedFacts ?? []) {
      this.record.append({ kind: 'sealed-fact', text: sf.text, knownTo: sf.knownTo, source: 'storyteller' });
    }
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
   * knowledge, death, sealed facts, ripples, prophecy contacts (warn → decay per dial).
   * Returns prophecies that need a Clerk ruling (aimed/prime touched by facts).
   *
   * Decay follows from what the PLAYER did — the locked decision, now enforced
   * three ways: contacts count only on player-initiated turns (never wakings or
   * arrivals), only from facts whose actor is the worn host (the world's own
   * drama never burns a prophecy), and at most once per prophecy per in-world
   * year (tempo runs on the calendar, not the scene count).
   */
  ingestTurn(params: { year: number; hostId: string; playerAction: string; turn: StorytellerTurn }): {
    contacts: Array<{ prophecy: Prophecy; result: 'warned' | 'decayed' }>;
    clerkChecks: Prophecy[];
  } {
    const { year, hostId, playerAction, turn } = params;
    const host = this.hostById(hostId);

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
    for (const sf of turn.sealedFacts ?? []) {
      this.record.append({ kind: 'sealed-fact', text: sf.text, knownTo: sf.knownTo, source: 'storyteller' });
    }
    for (const [i, r] of (turn.ripplesOpened ?? []).entries()) {
      this.record.append({
        kind: 'ripple-opened',
        rippleId: `r-${this.record.all().length}-${i}`,
        text: r,
        year,
      });
    }

    const playerInitiated = !['(waking)', '(arriving)', '(returning)'].includes(playerAction);
    const hostActorTags = new Set(
      turn.facts
        .filter((f) => {
          const a = f.actor.toLowerCase();
          return host !== undefined && (a === host.name.toLowerCase() || a === host.id.toLowerCase());
        })
        .flatMap((f) => f.tags.map((t) => t.toLowerCase())),
    );
    const allTags = new Set(turn.facts.flatMap((f) => f.tags.map((t) => t.toLowerCase())));

    // Years in which each prophecy has already been contacted (live events).
    const contactedYears = new Map<string, Set<number>>();
    for (const e of this.record.live()) {
      if (e.kind === 'prophecy-contact') {
        if (!contactedYears.has(e.prophecyId)) contactedYears.set(e.prophecyId, new Set());
        contactedYears.get(e.prophecyId)!.add(e.year);
      }
    }

    const s = this.state(); // includes the turn just committed
    const contacts: Array<{ prophecy: Prophecy; result: 'warned' | 'decayed' }> = [];
    const clerkChecks: Prophecy[] = [];

    for (const p of s.prophecies) {
      if (p.kind === 'loose' && (p.state === 'unaimed' || p.state === 'warned')) {
        if (!playerInitiated) continue;
        const touched = p.tags.some((t) => hostActorTags.has(t.toLowerCase()));
        if (!touched) continue;
        if (contactedYears.get(p.id)?.has(year)) continue; // once per year
        const result = p.contacts + 1 >= this.dials.contactsToDecay ? 'decayed' : 'warned';
        this.record.append({ kind: 'prophecy-contact', prophecyId: p.id, result, year });
        contacts.push({ prophecy: p, result });
      } else if (p.state === 'aimed' || p.kind === 'prime') {
        // Fulfillment checks are not rationed — the Clerk may look any time.
        const touched = p.tags.some((t) => allTags.has(t.toLowerCase()));
        if (touched && p.state !== 'fulfilled' && p.state !== 'spent' && p.state !== 'decayed') {
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
