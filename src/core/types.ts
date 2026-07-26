// ============================================================
// ANSELD prototype — shared types.
// The Record and Referee own all game state. The AI never does.
// ============================================================

export type Species = 'human' | 'raven' | 'rat';

export interface Host {
  id: string;
  name: string;
  species: Species;
  birthYear: number;
  /** Year the host dies. Humans never exceed birthYear + 50 (the ceiling). */
  deathYear: number;
  role: string; // "Tallyman", "ferrywoman", "salt-gardener"...
  homeLocation: string; // location id
  portraitId: string;
  /** One-line personality/situation seed for the storyteller. */
  seed: string;
  /** Set true by scar tier 2+: actions through this host may be reported. */
  watched: boolean;
}

export interface Location {
  id: string;
  name: string;
  roomArtId: string;
  /** Sealed locations admit only animal hosts (the rat rule). */
  sealed: boolean;
  description: string;
}

// ---------------- Prophecies ----------------

export type ProphecyState =
  | 'unaimed'
  | 'warned' // brushed once; one blank penciled in; next contact locks it
  | 'aimed'
  | 'decayed' // world filled the blanks carelessly (sealed sketch applies)
  | 'fulfilled'
  | 'spent';

export interface ProphecyRole {
  /** e.g. "the drowned man" */
  label: string;
  /** Bound entity name, once aimed/decayed. Null while blank. */
  boundTo: string | null;
  /** True if the binding was penciled in carelessly by a decay warning. */
  penciled: boolean;
}

export interface Prophecy {
  id: string;
  /** 'loose' or a prime condition ('prime'). Prime conditions cannot be aimed or decay. */
  kind: 'loose' | 'prime';
  /** The poetic face — the only part the player sees during play. */
  poetic: string;
  /** Hidden precise face: checkable fulfillment condition, fixed at birth. */
  hiddenCondition: string;
  roles: ProphecyRole[];
  /** Trigger subjects: events carrying these tags brush this prophecy. */
  tags: string[];
  /** Sealed at birth: the careless shape it takes if the world claims it. */
  sealedSketch: string;
  state: ProphecyState;
  /** Number of distinct turns whose facts touched this prophecy's tags. */
  contacts: number;
  /** The player's aiming declaration, verbatim, once aimed. */
  aimDeclaration: string | null;
}

// ---------------- Events (the append-only Ledger) ----------------

export interface Fact {
  actor: string;
  action: string;
  target?: string;
  locationId: string;
  /** Subject tags for prophecy contact matching, lowercase. */
  tags: string[];
}

export type GameEvent =
  | { kind: 'run-started'; seq: number; year: number }
  | { kind: 'possess'; seq: number; year: number; hostId: string; unmade?: boolean }
  | { kind: 'exit-host'; seq: number; year: number; hostId: string; unmade?: boolean }
  | { kind: 'jump'; seq: number; fromYear: number; toYear: number; unmade?: boolean }
  | {
      kind: 'turn';
      seq: number;
      year: number;
      hostId: string;
      playerAction: string;
      facts: Fact[];
      foreclosed: string;
      prose: string;
      unmade?: boolean;
    }
  | { kind: 'host-died'; seq: number; year: number; hostId: string; cause: string; unmade?: boolean }
  | {
      kind: 'rewind';
      seq: number;
      /** seq of the event we rewound TO (its state snapshot point). */
      toSeq: number;
      fromYear: number;
      toYear: number;
      /** 'window' = own occupied window (4a), 'dead-host' = dead host re-entry (4b). */
      mode: 'window' | 'dead-host';
    }
  | { kind: 'scar'; seq: number; year: number; note: string }
  | { kind: 'unwitnessed'; seq: number; fromYear: number; toYear: number }
  | { kind: 'prophecy-contact'; seq: number; prophecyId: string; result: 'warned' | 'decayed'; unmade?: boolean }
  | { kind: 'prophecy-aimed'; seq: number; prophecyId: string; declaration: string; bindings: Record<string, string>; unmade?: boolean }
  | { kind: 'prophecy-fulfilled'; seq: number; prophecyId: string; ruling: string; unmade?: boolean }
  | { kind: 'knowledge'; seq: number; text: string } // survives rewinds — knowledge is the player's
  | { kind: 'run-ended'; seq: number; outcome: 'won' | 'lost'; note: string };

// ---------------- Designer dials ----------------

export interface Dials {
  scarCap: number; // reach it and the run is lost
  tier2At: number; // scars at which Osric localises
  tier3At: number; // scars at which Osric predicts
  /** 0 = distant auditor .. 3 = actively pre-positioning. Scales storyteller directives. */
  osricIntensity: number;
  /** Contacts required before an unaimed prophecy decays (default 2: warn, then lock). */
  contactsToDecay: number;
  looseProphecyCount: number;
  storytellerModel: string;
  clerkModel: string;
  generatorModel: string;
}

export const DEFAULT_DIALS: Dials = {
  scarCap: 7,
  tier2At: 3,
  tier3At: 5,
  osricIntensity: 1,
  contactsToDecay: 2,
  looseProphecyCount: 3,
  storytellerModel: 'claude-haiku-4-5-20251001',
  clerkModel: 'claude-haiku-4-5-20251001',
  generatorModel: 'claude-sonnet-5',
};

// ---------------- Era sheet (output of the run generator) ----------------

export interface EraSheet {
  townName: string;
  eraStart: number;
  eraEnd: number;
  overview: string; // storyteller-facing summary of the town and its tensions
  locations: Location[];
  hosts: Host[];
  /** Prime prophecy: the run's win. Its conditions are prophecies of kind 'prime'. */
  primePoetic: string;
  primeConditions: Prophecy[];
  looseProphecies: Prophecy[];
}

// ---------------- Derived world state ----------------

export type ScarTier = 1 | 2 | 3;

export interface WorldState {
  year: number;
  currentHostId: string | null;
  scars: number;
  tier: ScarTier;
  prophecies: Prophecy[]; // prime conditions + loose, live states
  hosts: Host[]; // with watched flags applied
  facts: Fact[]; // committed facts, in order (unmade excluded)
  knowledge: string[]; // survives rewinds
  unwitnessed: Array<{ fromYear: number; toYear: number }>;
  outcome: 'playing' | 'won' | 'lost';
  outcomeNote: string;
}

// ---------------- Storyteller I/O ----------------

export interface TurnChoice {
  label: string;
}

export interface StorytellerTurn {
  prose: string;
  facts: Fact[];
  foreclosed: string;
  choices: TurnChoice[];
  /** Optional: host died this turn. */
  hostDied?: { cause: string };
  /** Optional: new knowledge the player gained (survives rewinds). */
  knowledgeGained?: string[];
}

export interface ClerkRuling {
  fulfilled: boolean;
  reasoning: string;
}
