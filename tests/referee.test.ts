import { describe, it, expect, beforeEach } from 'vitest';
import { GameRecord } from '../src/core/record';
import { Referee } from '../src/core/referee';
import { DEFAULT_DIALS } from '../src/core/types';
import type { Dials, StorytellerTurn } from '../src/core/types';
import { FIXTURE_SHEET } from '../src/mock/fixture';

function makeReferee(dialOverrides: Partial<Dials> = {}): Referee {
  const record = new GameRecord();
  record.append({ kind: 'run-started', year: FIXTURE_SHEET.eraStart });
  return new Referee(record, FIXTURE_SHEET, { ...DEFAULT_DIALS, ...dialOverrides });
}

function turnOf(partial: Partial<StorytellerTurn>): StorytellerTurn {
  return {
    prose: 'Something happens.',
    facts: [],
    foreclosed: 'Nothing of note.',
    choices: [{ label: 'Continue' }],
    ...partial,
  };
}

describe('possession legality (Law of Flesh)', () => {
  it('allows a fresh, legal possession', () => {
    const ref = makeReferee();
    expect(ref.classifyEntry('merra', 62).type).toBe('fresh');
  });

  it('refuses entry before birth and after death', () => {
    const ref = makeReferee();
    // rat-1 is born in 63 and dies in 66
    expect(ref.classifyEntry('rat-1', 62).type).toBe('illegal');
    expect(ref.classifyEntry('rat-1', 70).type).toBe('illegal');
  });

  it('refuses years outside the era', () => {
    const ref = makeReferee();
    expect(ref.classifyEntry('merra', 40).type).toBe('illegal');
    expect(ref.classifyEntry('merra', 80).type).toBe('illegal');
  });
});

describe('rewind pricing — scars are the single currency', () => {
  it('re-entering an occupied window costs exactly one scar and marks unwitnessed', () => {
    const ref = makeReferee();
    ref.possessFresh('merra', 62);
    ref.ingestTurn({ year: 62, hostId: 'merra', playerAction: 'look around', turn: turnOf({}) });
    ref.possessFresh('dovan', 65);
    ref.ingestTurn({ year: 65, hostId: 'dovan', playerAction: 'work the ferry', turn: turnOf({}) });

    const entry = ref.classifyEntry('merra', 62);
    expect(entry.type).toBe('rewind-window');
    if (entry.type !== 'rewind-window') return;
    expect(entry.warning).toContain('scar');

    ref.executeRewind(entry, 'merra', 62);
    const s = ref.state();
    expect(s.scars).toBe(1);
    expect(s.currentHostId).toBe('merra');
    expect(s.year).toBe(62);
    expect(s.unwitnessed.length).toBe(1);
    // Returning to the window's start un-happens everything since arrival —
    // the player's own turn there and the dovan window both.
    expect(s.facts.length).toBe(0);
    const turnEvents = ref.record.all().filter((e) => e.kind === 'turn');
    expect(turnEvents.length).toBe(2);
    expect(turnEvents.every((e) => 'unmade' in e && e.unmade)).toBe(true);
  });

  it('re-entering a dead host costs a scar (the free save button is closed)', () => {
    const ref = makeReferee();
    ref.possessFresh('corb', 64);
    ref.ingestTurn({
      year: 64,
      hostId: 'corb',
      playerAction: 'confront the Warden',
      turn: turnOf({ hostDied: { cause: 'seized by the Assize' } }),
    });

    const entry = ref.classifyEntry('corb', 63);
    expect(entry.type).toBe('rewind-dead-host');
    if (entry.type !== 'rewind-dead-host') return;

    ref.executeRewind(entry, 'corb', 63);
    const s = ref.state();
    expect(s.scars).toBe(1);
    expect(s.currentHostId).toBe('corb');
    expect(s.year).toBe(63);
    // Overwritten stretch of the host's thread is on the record as unwitnessed.
    expect(s.unwitnessed.some((u) => u.fromYear === 63)).toBe(true);
  });

  it('knowledge survives a rewind; facts do not (the lamp-attempt loop)', () => {
    const ref = makeReferee();
    ref.possessFresh('merra', 62);
    ref.ingestTurn({ year: 62, hostId: 'merra', playerAction: 'anchor', turn: turnOf({}) });
    ref.ingestTurn({
      year: 62,
      hostId: 'merra',
      playerAction: 'try the vault ledger',
      turn: turnOf({
        facts: [{ actor: 'Merra', action: 'opened the restricted ledger', locationId: 'assize-office', tags: ['ledger'] }],
        knowledgeGained: ['The Warden initials pages he has not read.'],
      }),
    });

    // Rewind to the first window moment.
    const entry = ref.classifyEntry('merra', 62);
    expect(entry.type).toBe('rewind-window');
    if (entry.type !== 'rewind-window') return;
    ref.executeRewind(entry, 'merra', 62);

    const s = ref.state();
    expect(s.knowledge).toContain('The Warden initials pages he has not read.');
    expect(s.facts.find((f) => f.action === 'opened the restricted ledger')).toBeUndefined();
    expect(s.scars).toBe(1);
  });
});

describe('loss — the scar cap is the only loss', () => {
  it('reaching the cap ends the run as lost', () => {
    const ref = makeReferee({ scarCap: 2 });
    ref.possessFresh('merra', 62);
    ref.ingestTurn({ year: 62, hostId: 'merra', playerAction: 'a', turn: turnOf({}) });
    ref.possessFresh('dovan', 65);
    ref.ingestTurn({ year: 65, hostId: 'dovan', playerAction: 'b', turn: turnOf({}) });

    let entry = ref.classifyEntry('merra', 62);
    if (entry.type === 'rewind-window') ref.executeRewind(entry, 'merra', 62);
    expect(ref.checkEnd().outcome).toBe('playing');

    ref.possessFresh('dovan', 66);
    ref.ingestTurn({ year: 66, hostId: 'dovan', playerAction: 'c', turn: turnOf({}) });
    entry = ref.classifyEntry('merra', 62);
    if (entry.type === 'rewind-window') ref.executeRewind(entry, 'merra', 62);

    const s = ref.checkEnd();
    expect(s.scars).toBe(2);
    expect(s.outcome).toBe('lost');
  });
});

describe('scar tiers and their teeth', () => {
  it('tier rises with scars per the dials, and tier 2 marks worked locations watched', () => {
    const ref = makeReferee({ tier2At: 1, tier3At: 3, scarCap: 10 });
    ref.possessFresh('merra', 62);
    ref.ingestTurn({
      year: 62,
      hostId: 'merra',
      playerAction: 'work in the office',
      turn: turnOf({ facts: [{ actor: 'Merra', action: 'copied a folio', locationId: 'assize-office', tags: ['folio'] }] }),
    });
    ref.possessFresh('dovan', 65);
    ref.ingestTurn({ year: 65, hostId: 'dovan', playerAction: 'x', turn: turnOf({}) });
    const entry = ref.classifyEntry('merra', 62);
    if (entry.type === 'rewind-window') ref.executeRewind(entry, 'merra', 62);

    const s = ref.state();
    expect(s.tier).toBe(2);
    const merra = s.hosts.find((h) => h.id === 'merra')!;
    const raven = s.hosts.find((h) => h.id === 'raven-1')!;
    expect(merra.watched).toBe(true); // home is the assize office, where the player worked
    expect(raven.watched).toBe(true); // same roost
    expect(s.hosts.find((h) => h.id === 'issa')!.watched).toBe(false);
    expect(ref.osricDirectives().join(' ')).toContain('TIER 2');
  });
});

describe('prophecy machinery — sentences with blanks', () => {
  it('first contact warns, second contact decays (default tempo)', () => {
    const ref = makeReferee();
    ref.possessFresh('dovan', 65);

    const ferryFact = { actor: 'Dovan', action: 'made a crossing', locationId: 'ferry-dock', tags: ['ferry', 'crossing'] };
    let result = ref.ingestTurn({ year: 65, hostId: 'dovan', playerAction: 'cross', turn: turnOf({ facts: [ferryFact] }) });
    expect(result.contacts.length).toBe(1);
    expect(result.contacts[0].result).toBe('warned');
    expect(ref.state().prophecies.find((p) => p.id === 'loose-1')!.state).toBe('warned');

    result = ref.ingestTurn({ year: 65, hostId: 'dovan', playerAction: 'cross again', turn: turnOf({ facts: [ferryFact] }) });
    expect(result.contacts[0].result).toBe('decayed');
    expect(ref.state().prophecies.find((p) => p.id === 'loose-1')!.state).toBe('decayed');
  });

  it('decay tempo is a dial', () => {
    const ref = makeReferee({ contactsToDecay: 1 });
    ref.possessFresh('dovan', 65);
    const result = ref.ingestTurn({
      year: 65,
      hostId: 'dovan',
      playerAction: 'cross',
      turn: turnOf({ facts: [{ actor: 'Dovan', action: 'crossing', locationId: 'ferry-dock', tags: ['ferry'] }] }),
    });
    expect(result.contacts[0].result).toBe('decayed');
  });

  it('aiming requires every blank named, is permanent, and shields from decay', () => {
    const ref = makeReferee();
    ref.possessFresh('dovan', 65);

    expect(ref.aimProphecy('loose-1', 'Dovan carries Issa twice.', { 'the ferryman': 'Dovan Reed' }).ok).toBe(false);

    const aim = ref.aimProphecy('loose-1', 'Dovan will carry Issa across twice.', {
      'the ferryman': 'Dovan Reed',
      'the passenger': 'Issa Brine',
    });
    expect(aim.ok).toBe(true);

    // No re-aim.
    expect(ref.aimProphecy('loose-1', 'changed my mind', { 'the ferryman': 'Corb', 'the passenger': 'Merra' }).ok).toBe(false);

    // Contact now routes to the Clerk instead of decaying.
    const result = ref.ingestTurn({
      year: 65,
      hostId: 'dovan',
      playerAction: 'cross with Issa',
      turn: turnOf({ facts: [{ actor: 'Dovan', action: 'carried Issa', locationId: 'ferry-dock', tags: ['ferry', 'passenger'] }] }),
    });
    expect(result.contacts.length).toBe(0);
    expect(result.clerkChecks.map((p) => p.id)).toContain('loose-1');

    const p = ref.state().prophecies.find((x) => x.id === 'loose-1')!;
    expect(p.state).toBe('aimed');
    expect(p.roles.find((r) => r.label === 'the passenger')!.boundTo).toBe('Issa Brine');
  });

  it('prime conditions cannot be aimed and cannot decay, only route to the Clerk', () => {
    const ref = makeReferee();
    ref.possessFresh('merra', 62);
    expect(ref.aimProphecy('prime-1', 'x', { 'the reader': 'Merra' }).ok).toBe(false);

    const fact = { actor: 'Merra', action: 'read a folio aloud', locationId: 'ferry-dock', tags: ['folio', 'dock', 'public'] };
    const r1 = ref.ingestTurn({ year: 62, hostId: 'merra', playerAction: 'read', turn: turnOf({ facts: [fact] }) });
    expect(r1.clerkChecks.map((p) => p.id)).toContain('prime-1');
    const r2 = ref.ingestTurn({ year: 62, hostId: 'merra', playerAction: 'read again', turn: turnOf({ facts: [fact] }) });
    expect(r2.clerkChecks.map((p) => p.id)).toContain('prime-1');
    expect(ref.state().prophecies.find((p) => p.id === 'prime-1')!.state).toBe('unaimed');
  });

  it('all prime conditions fulfilled wins the run', () => {
    const ref = makeReferee();
    ref.possessFresh('merra', 62);
    ref.recordFulfillment('prime-1', 'read aloud, witnessed');
    ref.recordFulfillment('prime-2', 'pans yield');
    expect(ref.checkEnd().outcome).toBe('playing');
    ref.recordFulfillment('prime-3', 'the mark is his, the words are not');
    const s = ref.checkEnd();
    expect(s.outcome).toBe('won');
  });
});

describe('sealed places (comprehension traded for access)', () => {
  it('humans cannot enter sealed locations; animals can', () => {
    const ref = makeReferee();
    expect(ref.canEnterLocation('merra', 'undervault').ok).toBe(false);
    expect(ref.canEnterLocation('rat-1', 'undervault').ok).toBe(true);
    expect(ref.canEnterLocation('merra', 'assize-office').ok).toBe(true);
  });
});

describe('the Ledger does not un-count', () => {
  it('unmade events remain in the full record with their folio numbers', () => {
    const ref = makeReferee();
    ref.possessFresh('merra', 62);
    ref.ingestTurn({ year: 62, hostId: 'merra', playerAction: 'a', turn: turnOf({}) });
    ref.ingestTurn({ year: 62, hostId: 'merra', playerAction: 'b', turn: turnOf({}) });
    const totalBefore = ref.record.all().length;

    const entry = ref.classifyEntry('merra', 62);
    if (entry.type === 'rewind-window') ref.executeRewind(entry, 'merra', 62);

    expect(ref.record.all().length).toBeGreaterThan(totalBefore); // pages added, none removed
    expect(ref.record.all().some((e) => 'unmade' in e && e.unmade)).toBe(true);
  });
});
