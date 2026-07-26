// End-to-end mock runs: the full loop with zero AI calls.

import { describe, it, expect } from 'vitest';
import { Engine } from '../src/game/engine';
import { MockClerk, MockStoryteller } from '../src/mock/mock';
import { DEFAULT_DIALS } from '../src/core/types';
import { FIXTURE_SHEET } from '../src/mock/fixture';

function makeEngine(clerk = new MockClerk(), dials = { ...DEFAULT_DIALS }) {
  return new Engine(FIXTURE_SHEET, dials, new MockStoryteller(), clerk);
}

describe('mock run — the core loop end to end', () => {
  it('wakes inhabited, warns on contact, and decays only across years', async () => {
    const engine = makeEngine();
    const opening = await engine.startRun('dovan');
    expect(opening.prose).toContain('Dovan');
    expect(opening.choices.length).toBeGreaterThan(0);

    const t1 = await engine.act('Work the ferry crossing');
    expect(t1.notes.some((n) => n.kind === 'prophecy-warned')).toBe(true);

    // Same year: the calendar protects it.
    const t2 = await engine.act('Work the ferry crossing');
    expect(t2.notes.some((n) => n.kind === 'prophecy-decayed')).toBe(false);

    // Next year: the world claims it.
    const jump = await engine.requestJump('dovan', 61);
    expect(jump.kind).toBe('scene');
    const t3 = await engine.act('Work the ferry crossing');
    expect(t3.notes.some((n) => n.kind === 'prophecy-decayed')).toBe(true);
    expect(t3.state.prophecies.find((p) => p.id === 'loose-1')!.state).toBe('decayed');
  });

  it('forward jumps settle the gap: chronicle shown, ripples closed, body memories surface', async () => {
    const engine = makeEngine();
    await engine.startRun('merra');
    await engine.act('Take stock of the room');

    // Jump forward to Corb in 65: exiting Merra opens a ripple; the gap settles it.
    const jump = await engine.requestJump('corb', 65);
    expect(jump.kind).toBe('scene');
    if (jump.kind !== 'scene') return;
    const notes = jump.result.notes;
    expect(notes.some((n) => n.kind === 'settling')).toBe(true);
    // Corb carries a sealed truth (the hidden folio) — surfaced on possession.
    expect(jump.result.state.knowledge.some((k) => k.includes('ninth evaporation pan'))).toBe(true);
    // Note: the exit-ripple for Merra opened AFTER the settlement of the gap,
    // so it remains open — visible in the ripple ledger, awaiting the next jump.
    expect(jump.result.state.ripples.length).toBe(1);

    const jump2 = await engine.requestJump('issa', 70);
    expect(jump2.kind).toBe('scene');
    if (jump2.kind !== 'scene') return;
    expect(jump2.result.notes.some((n) => n.kind === 'ripple')).toBe(true);
    // Merra's thread settled in this gap; Corb's opened fresh at the exit.
    expect(jump2.result.state.ripples.length).toBe(1);
  });

  it('aimed prophecy routes to the clerk and fulfills; foreclosure notes appear', async () => {
    const engine = makeEngine(new MockClerk(new Set(['loose-1'])));
    await engine.startRun('dovan');

    const aim = engine.aim('loose-1', 'Dovan will carry the same soul twice.', {
      'the ferryman': 'Dovan Reed',
      'the passenger': 'Issa Brine',
    });
    expect(aim.ok).toBe(true);

    const t = await engine.act('Work the ferry crossing');
    expect(t.notes.some((n) => n.kind === 'prophecy-fulfilled')).toBe(true);
    expect(t.notes.some((n) => n.kind === 'foreclosed')).toBe(true);
    expect(t.state.prophecies.find((p) => p.id === 'loose-1')!.state).toBe('fulfilled');
  });

  it('death is an exit with a data payload; dead-host re-entry is warned and priced', async () => {
    const engine = makeEngine();
    await engine.startRun('corb');
    const death = await engine.act('Confront the Warden');
    expect(death.state.currentHostId).toBeNull();
    expect(death.state.knowledge.length).toBeGreaterThan(0);

    // Move on, then come back for the dead man.
    const fresh = await engine.requestJump('merra', 65);
    expect(fresh.kind).toBe('scene');

    const reentry = await engine.requestJump('corb', 61);
    expect(reentry.kind).toBe('needs-confirmation');
    if (reentry.kind !== 'needs-confirmation') return;
    expect(reentry.warning).toContain('scar');
    if (reentry.entry.type !== 'rewind-dead-host' && reentry.entry.type !== 'rewind-window') return;

    const back = await engine.confirmRewind(reentry.entry, 'corb', 61);
    expect(back.state.scars).toBe(1);
    expect(back.state.currentHostId).toBe('corb');
    // Knowledge from the confrontation survived the rewind.
    expect(back.state.knowledge).toContain('The Warden signs seizure orders without reading them.');
    // The overwritten stretch is on the record.
    expect(back.state.unwitnessed.length).toBeGreaterThan(0);
  });

  it('a run can be lost at the scar cap', async () => {
    const engine = makeEngine(new MockClerk(), { ...DEFAULT_DIALS, scarCap: 1 });
    await engine.startRun('corb');
    await engine.act('Confront the Warden');
    await engine.requestJump('merra', 65);

    const reentry = await engine.requestJump('corb', 61);
    if (reentry.kind !== 'needs-confirmation') throw new Error('expected confirmation');
    if (reentry.entry.type !== 'rewind-dead-host') throw new Error('expected dead-host');
    const end = await engine.confirmRewind(reentry.entry, 'corb', 61);
    expect(end.state.outcome).toBe('lost');
    expect(end.choices.length).toBe(0);
  });

  it('a run can be won: all prime conditions ruled fulfilled', async () => {
    const engine = makeEngine(new MockClerk(new Set(['prime-1', 'prime-2', 'prime-3'])));
    await engine.startRun('merra');

    // prime-1: read a folio aloud on the dock (tags touch prime-1).
    const t = await engine.act('Read the folio aloud on the dock');
    expect(t.state.prophecies.find((p) => p.id === 'prime-1')!.state).toBe('fulfilled');

    // The remaining prime conditions fulfilled via their tag routes.
    engine.referee.recordFulfillment('prime-2', 'the pans yield');
    engine.referee.recordFulfillment('prime-3', 'his mark, not his words');
    const s = engine.referee.checkEnd();
    expect(s.outcome).toBe('won');
  });

  it('questions are thought: consider() files no facts and brushes no prophecies', async () => {
    const engine = makeEngine();
    await engine.startRun('dovan');
    const before = engine.state();

    const result = await engine.consider('What do I know about the drowned children?');
    expect(result.prose.length).toBeGreaterThan(0);

    const after = engine.state();
    expect(after.facts.length).toBe(before.facts.length);
    expect(after.prophecies.every((p) => p.contacts === 0)).toBe(true);
    expect(engine.referee.record.all().filter((e) => e.kind === 'turn').length).toBe(
      1, // only the opening scene
    );
  });

  it('designer override can reset a decayed prophecy to unaimed', async () => {
    const engine = makeEngine(new MockClerk(), { ...DEFAULT_DIALS, contactsToDecay: 1 });
    await engine.startRun('dovan');
    await engine.act('Work the ferry crossing');
    expect(engine.state().prophecies.find((p) => p.id === 'loose-1')!.state).toBe('decayed');

    engine.referee.resetProphecy('loose-1', 'playtest repair');
    const p = engine.state().prophecies.find((x) => x.id === 'loose-1')!;
    expect(p.state).toBe('unaimed');
    expect(p.contacts).toBe(0);
    // The override itself is on the Ledger, not hidden.
    expect(engine.referee.record.all().some((e) => e.kind === 'prophecy-reset')).toBe(true);
  });

  it('free movement is free: fresh windows cost nothing', async () => {
    const engine = makeEngine();
    await engine.startRun('merra');
    await engine.act('Take stock of the room');
    const jump = await engine.requestJump('issa', 70);
    expect(jump.kind).toBe('scene');
    const s = engine.state();
    expect(s.scars).toBe(0);
    expect(s.year).toBe(70);
    expect(s.currentHostId).toBe('issa');
  });
});
