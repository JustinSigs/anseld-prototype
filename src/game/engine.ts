// ============================================================
// The Engine — orchestrates one turn of play.
// Player intent → Referee validation → Storyteller (AI or mock)
// → fact report ingested → Clerk rulings → margin notes out.
// The Engine never decides rules; it only sequences them.
// ============================================================

import { GameRecord } from '../core/record';
import { Referee, type EntryClass } from '../core/referee';
import type { Dials, EraSheet, Host, Prophecy, Settlement, StorytellerTurn, WorldState } from '../core/types';

export interface SceneContext {
  sheet: EraSheet;
  state: WorldState;
  host: Host;
  year: number;
  locationId: string;
  /** Scar-tier directives from the Referee (Osric's teeth). */
  directives: string[];
  /** Last few committed prose blocks, for continuity. */
  recentProse: string[];
  /** Facts the player knows (survives rewinds — knowledge is the player's). */
  knowledge: string[];
}

export interface Storyteller {
  /** First scene after arriving in a host (Law of Waking: begin inhabited). */
  openScene(ctx: SceneContext): Promise<StorytellerTurn>;
  playTurn(ctx: SceneContext, playerAction: string): Promise<StorytellerTurn>;
  /**
   * Recollection: the player asking their own continuous mind, not the world.
   * Answers from the record only. Files no facts, brushes no prophecies,
   * costs nothing but the words. Questions are thought; commands are acts.
   */
  answerQuestion(ctx: SceneContext, question: string): Promise<string>;
  /**
   * Settle a forward gap in time: given the open ripples and the record,
   * decide what the unobserved years did with what was left, as committed
   * facts and a chronicle the player reads. The wake is not free.
   */
  settle(params: { sheet: EraSheet; state: WorldState; fromYear: number; toYear: number }): Promise<Settlement>;
}

export interface Clerk {
  /** Blind ruling: does the record satisfy this prophecy's hidden face? */
  rule(prophecy: Prophecy, recordExcerpt: string): Promise<{ fulfilled: boolean; reasoning: string }>;
}

export interface MarginNote {
  kind: 'foreclosed' | 'prophecy-warned' | 'prophecy-decayed' | 'prophecy-fulfilled' | 'scar' | 'system' | 'settling' | 'ripple';
  text: string;
}

export interface TurnResult {
  prose: string;
  choices: string[];
  notes: MarginNote[];
  state: WorldState;
}

export class Engine {
  referee: Referee;
  private locationId: string;
  private lastChoices: string[] = [];
  private recentProse: string[] = [];

  constructor(
    public sheet: EraSheet,
    public dials: Dials,
    private storyteller: Storyteller,
    private clerk: Clerk,
    record?: GameRecord,
  ) {
    this.referee = new Referee(record ?? new GameRecord(), sheet, dials);
    this.locationId = sheet.locations[0].id;
  }

  state(): WorldState {
    return this.referee.state();
  }

  /** UI continuity for save/resume — no game state lives here. */
  uiState() {
    return { locationId: this.locationId, lastChoices: this.lastChoices, recentProse: this.recentProse };
  }

  restoreUi(s: { locationId: string; lastChoices: string[]; recentProse: string[] }) {
    this.locationId = s.locationId;
    this.lastChoices = s.lastChoices;
    this.recentProse = s.recentProse;
  }

  currentHost(): Host | null {
    const id = this.state().currentHostId;
    return id ? (this.referee.hostById(id) ?? null) : null;
  }

  currentLocationId(): string {
    return this.locationId;
  }

  private context(): SceneContext {
    const state = this.state();
    const host = this.currentHost();
    if (!host) throw new Error('No host — the Law of Flesh is being violated.');
    return {
      sheet: this.sheet,
      state,
      host,
      year: state.year,
      locationId: this.locationId,
      directives: this.referee.osricDirectives(),
      recentProse: this.recentProse.slice(-3),
      knowledge: state.knowledge,
    };
  }

  /** The host the telling opens in, absent an explicit choice. */
  static defaultStartingHost(sheet: EraSheet) {
    return sheet.hosts.find((h) => h.species === 'human' && h.birthYear <= sheet.eraStart && h.deathYear >= sheet.eraStart);
  }

  /** Begin the run: Law of Waking — the telling begins already inhabited. */
  async startRun(initialHostId?: string): Promise<TurnResult> {
    this.referee.record.append({ kind: 'run-started', year: this.sheet.eraStart });
    // The era's hidden truths go into the Record before anyone wakes:
    // mysteries are born with answers.
    for (const t of this.sheet.sealedTruths ?? []) {
      this.referee.record.append({ kind: 'sealed-fact', text: t.text, knownTo: t.knownTo, source: 'generator' });
    }
    const host =
      (initialHostId && this.referee.hostById(initialHostId)) ?? Engine.defaultStartingHost(this.sheet);
    if (!host) throw new Error('No living human host at era start.');
    this.referee.record.append({ kind: 'possess', year: this.sheet.eraStart, hostId: host.id });
    this.referee.grantHostMemory(host.id);
    this.locationId = host.homeLocation;

    const turn = await this.storyteller.openScene(this.context());
    return this.commitTurn('(waking)', turn);
  }

  /** A question asked of the self: no turn, no facts, no contacts, no cost but words. */
  async consider(question: string): Promise<TurnResult> {
    const state = this.state();
    if (state.outcome !== 'playing') return this.endedResult(state);
    if (!this.currentHost()) throw new Error('No host.');
    const prose = await this.storyteller.answerQuestion(this.context(), question);
    return {
      prose,
      choices: this.lastChoices,
      notes: [{ kind: 'system', text: 'A recollection. Nothing happened; nothing was brushed. Questions are thought — commands are acts.' }],
      state,
    };
  }

  /** Play one turn: a clicked choice or a free-text action. */
  async act(playerAction: string): Promise<TurnResult> {
    const state = this.state();
    if (state.outcome !== 'playing') return this.endedResult(state);
    const host = this.currentHost();
    if (!host) throw new Error('No host.');

    const turn = await this.storyteller.playTurn(this.context(), playerAction);

    // Referee validates the fact report before it is committed:
    // a human host can never act inside a sealed room.
    const invalid = turn.facts.find(
      (f) => host.species === 'human' && this.referee.locationById(f.locationId)?.sealed,
    );
    if (invalid) {
      return {
        prose: this.referee.canEnterLocation(host.id, invalid.locationId).reason ?? 'The way is sealed.',
        choices: this.lastChoices,
        notes: [{ kind: 'system', text: 'The Referee refused that scene: sealed places admit no human host.' }],
        state,
      };
    }

    return this.commitTurn(playerAction, turn);
  }

  private async commitTurn(playerAction: string, turn: StorytellerTurn): Promise<TurnResult> {
    const state = this.state();
    const host = this.currentHost()!;
    const notes: MarginNote[] = [];

    const { contacts, clerkChecks } = this.referee.ingestTurn({
      year: state.year,
      hostId: host.id,
      playerAction,
      turn,
    });

    if (turn.facts.length > 0) {
      this.locationId = turn.facts[turn.facts.length - 1].locationId;
    }

    for (const c of contacts) {
      if (c.result === 'warned') {
        notes.push({
          kind: 'prophecy-warned',
          text: `The ink is moving on a prophecy: “${c.prophecy.poetic}” The world has started penciling in its blanks. Aim it, or lose it.`,
        });
      } else {
        notes.push({
          kind: 'prophecy-decayed',
          text: `A prophecy has locked without you: “${c.prophecy.poetic}” ${c.prophecy.sealedSketch}`,
        });
      }
    }

    for (const p of clerkChecks) {
      const ruling = await this.clerk.rule(p, this.recordExcerptFor(p));
      if (ruling.fulfilled) {
        this.referee.recordFulfillment(p.id, ruling.reasoning);
        notes.push({
          kind: 'prophecy-fulfilled',
          text:
            p.kind === 'prime'
              ? `A condition of the prime prophecy stands: “${p.poetic}” — ${ruling.reasoning}`
              : `A prophecy has come true as aimed: “${p.poetic}” — ${ruling.reasoning}`,
        });
      }
    }

    for (const r of turn.ripplesOpened ?? []) {
      notes.push({ kind: 'ripple', text: `A thread left running: ${r}` });
    }
    if (turn.foreclosed && turn.foreclosed.trim()) {
      notes.push({ kind: 'foreclosed', text: `Foreclosed: ${turn.foreclosed}` });
    }
    if (turn.hostDied) {
      notes.push({ kind: 'system', text: `${host.name} is dead — ${turn.hostDied.cause}. The exit is open; the wake is not.` });
    }

    this.recentProse.push(turn.prose);
    this.lastChoices = turn.choices.map((c) => c.label);

    const after = this.referee.checkEnd();
    if (after.outcome !== 'playing') return this.endedResult(after, turn.prose, notes);

    return { prose: turn.prose, choices: this.lastChoices, notes, state: after };
  }

  /**
   * Jump to (host, year). Fresh windows are free. Priced entries return a
   * warning first — the Law of the Open Door: warned, every time.
   */
  async requestJump(hostId: string, year: number): Promise<
    | { kind: 'scene'; result: TurnResult }
    | { kind: 'needs-confirmation'; entry: EntryClass; warning: string }
    | { kind: 'refused'; reason: string }
  > {
    const entry = this.referee.classifyEntry(hostId, year);
    if (entry.type === 'illegal') return { kind: 'refused', reason: entry.reason };
    if (entry.type === 'rewind-window' || entry.type === 'rewind-dead-host') {
      return { kind: 'needs-confirmation', entry, warning: entry.warning };
    }

    // A forward jump reckons the gap first: the unobserved years settle what
    // was left running, and the player reads the chronicle. The wake is not free.
    const settleNotes: MarginNote[] = [];
    const latest = this.referee.latestPlayedYear();
    if (year > latest) {
      const settlement = await this.storyteller.settle({
        sheet: this.sheet,
        state: this.state(),
        fromYear: latest,
        toYear: year,
      });
      this.referee.commitSettlement(latest, year, settlement);
      if (settlement.chronicle.trim()) {
        settleNotes.push({ kind: 'settling', text: `Years ${latest}–${year} settle: ${settlement.chronicle}` });
      }
      for (const res of settlement.rippleResolutions) {
        settleNotes.push({ kind: 'ripple', text: `A thread closes: ${res.resolution}` });
      }
    }

    const remembered = this.referee.possessFresh(hostId, year);
    const host = this.referee.hostById(hostId)!;
    for (const k of remembered) {
      settleNotes.push({ kind: 'system', text: `This body carries something: ${k}` });
    }
    this.locationId = host.homeLocation;
    const turn = await this.storyteller.openScene(this.context());
    const result = await this.commitTurn('(arriving)', turn);
    result.notes.unshift(...settleNotes);
    return { kind: 'scene', result };
  }

  /** The player was warned and chose the scar. */
  async confirmRewind(entry: Extract<EntryClass, { type: 'rewind-window' | 'rewind-dead-host' }>, hostId: string, year: number): Promise<TurnResult> {
    this.referee.executeRewind(entry, hostId, year);
    this.referee.grantHostMemory(hostId);
    const host = this.referee.hostById(hostId)!;
    this.locationId = host.homeLocation;
    this.recentProse = [];

    const scarNote: MarginNote = {
      kind: 'scar',
      text: `Scar ${this.state().scars} of ${this.dials.scarCap}. The Ledger did not un-count what it counted.`,
    };
    const ended = this.referee.checkEnd();
    if (ended.outcome !== 'playing') return this.endedResult(ended, undefined, [scarNote]);

    const turn = await this.storyteller.openScene(this.context());
    const result = await this.commitTurn('(returning)', turn);
    result.notes.unshift(scarNote);
    return result;
  }

  /** Aiming: declaration in the player's words, every blank named. Irrevocable. */
  aim(prophecyId: string, declaration: string, bindings: Record<string, string>): { ok: boolean; reason?: string } {
    return this.referee.aimProphecy(prophecyId, declaration, bindings);
  }

  private recordExcerptFor(p: Prophecy): string {
    const facts = this.state()
      .facts.filter((f) => f.tags.some((t) => p.tags.map((x) => x.toLowerCase()).includes(t.toLowerCase())))
      .map((f) => `- ${f.actor} ${f.action}${f.target ? ' → ' + f.target : ''} (at ${f.locationId})`)
      .join('\n');
    const bindings = p.roles.map((r) => `${r.label} = ${r.boundTo ?? '(blank)'}`).join('; ');
    return `Bindings: ${bindings}\nRelevant committed facts:\n${facts || '- none'}`;
  }

  private endedResult(state: WorldState, prose?: string, notes: MarginNote[] = []): TurnResult {
    const closing =
      state.outcome === 'won'
        ? `THE RUN IS WON. ${state.outcomeNote}`
        : `THE RUN IS LOST. ${state.outcomeNote}`;
    return {
      prose: prose ? `${prose}\n\n${closing}` : closing,
      choices: [],
      notes: [...notes, { kind: 'system', text: closing }],
      state,
    };
  }
}
