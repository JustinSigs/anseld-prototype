// ============================================================
// The live Storyteller — writes scenes from facts it is handed.
// It owns no state, enforces no rules, and files a fact report
// with every scene. The Referee audits everything it returns.
// ============================================================

import type { Clerk, SceneContext, Storyteller } from '../game/engine';
import type { Prophecy, StorytellerTurn } from '../core/types';
import { ClaudeClient } from './client';

const STORYTELLER_SYSTEM = `You are the Storyteller for ANSELD, a grim, quiet fantasy about an unbodied intelligence possessing hosts in a salt-lake kingdom where nobody lives past fifty. Your prose is spare, cold, and precise. Sentences like ledger entries. No purple language, no exclamation points, no melodrama. The world is authored by its records: folios, tallies, salt.

You write ONE scene per request, from the facts you are given. You do not track state — the Ledger (the game code) does that and tells you everything true. You never contradict a fact you are given.

HARD RULES you must respect in fiction:
- The player is an unbodied intelligence currently inhabiting the HOST named below. Hosts retain nothing of the player after exit; knowledge belongs to the player alone.
- Humans never survive past fifty. Nobody in Anseld remarks on this; it is simply true.
- Sealed locations admit no human host. Never narrate a human host inside one.
- Animal hosts cannot speak, read, or use hands. They trade comprehension for access.
- Aimed prophecies listed below are FATE: bend events plausibly toward them. Never resolve one yourself — you report facts; the Clerk rules.
- Unaimed prophecies listed below exist in the world's grain. You may brush their subjects naturally, but never quote them or explain them.

Respond with ONLY valid JSON, no code fences:
{
  "prose": "the scene, 80-180 words",
  "facts": [{"actor": "name", "action": "what verifiably happened", "target": "optional", "locationId": "one of the listed location ids", "tags": ["only tags from the provided vocabulary that literally apply"]}],
  "foreclosed": "one short sentence naming what this action just made impossible (empty string if truly nothing)",
  "choices": [{"label": "3-4 concrete actions the host could take next, each under 10 words"}],
  "hostDied": {"cause": "..."} (ONLY if the host dies this scene — death must follow plausibly from the action),
  "knowledgeGained": ["a discrete durable fact the player learned, if any"],
  "sealedFacts": [{"text": "...", "knownTo": ["names"]}] (REQUIRED whenever this scene introduces a mystery or an unexplained deliberate act: fix its hidden truth NOW — who did it, why — and name who in the era knows. A mystery with no committed answer is forbidden. Never reveal sealed truths in prose except through legitimate discovery.),
  "ripplesOpened": ["one line per thread this scene leaves running — a scandal started, a person set on a course, a body unfound"]
}

Facts are the official record: list only things that verifiably happened in the scene, one entry per meaningful event. Tag honestly — tags are how the Ledger sees. Omitting an applicable tag is falsifying the record; adding an inapplicable one is the same.

Mental acts are NEVER facts. A host recalling, wondering, noticing, deliberating, or the player considering their position produces NO fact entries and NO tags — thought leaves no mark in the Ledger. Only physical, witnessable events are facts.

SEALED TRUTHS you will be given are the world's fixed hidden answers. Every scene must stay consistent with them. Characters who know a truth act like people keeping it; characters who don't, don't. You never contradict a sealed truth and never reveal one except through the player's legitimate discovery (and when revealed, report it as knowledgeGained).`;

export class LiveStoryteller implements Storyteller {
  constructor(
    private client: ClaudeClient,
    private model: () => string,
  ) {}

  async openScene(ctx: SceneContext): Promise<StorytellerTurn> {
    return this.call(ctx, null);
  }

  async playTurn(ctx: SceneContext, playerAction: string): Promise<StorytellerTurn> {
    return this.call(ctx, playerAction);
  }

  async settle(params: { sheet: import('../core/types').EraSheet; state: import('../core/types').WorldState; fromYear: number; toYear: number }): Promise<import('../core/types').Settlement> {
    const { sheet, state, fromYear, toYear } = params;
    const raw = await this.client.completeJson<{
      chronicle: string;
      facts: Array<{ actor: string; action: string; target?: string; locationId: string; tags: string[] }>;
      rippleResolutions: Array<{ rippleId: string; resolution: string }>;
      sealedFacts?: Array<{ text: string; knownTo: string[] }>;
    }>({
      kind: 'storyteller',
      model: this.model(),
      system:
        `You settle unobserved time in ANSELD. The player jumped from Year ${fromYear} to Year ${toYear}; nobody witnessed the gap. ` +
        'Decide, soberly and plausibly, what those years did with the threads that were left running. Consequences follow from what stands on the record — no new dramas invented for excitement, no mercy either. People age; the fifty-year ceiling holds; unattended trouble compounds quietly. ' +
        'Respond with ONLY valid JSON: {"chronicle": "3-6 spare sentences the player will read — what changed, told cold", "facts": [{"actor","action","target","locationId","tags":[]}] (the concrete outcomes, using known location ids), "rippleResolutions": [{"rippleId": "exact id given", "resolution": "one line"}] (resolve every open ripple whose thread would plausibly conclude in this gap; leave truly slow threads open), "sealedFacts": [{"text","knownTo":[]}] (only if the gap creates a new hidden truth)}',
      user: [
        `TOWN: ${sheet.townName}. ${sheet.overview}`,
        `ANTAGONIST: ${sheet.antagonist.name}, ${sheet.antagonist.title}.`,
        `LOCATION IDS: ${sheet.locations.map((l) => l.id).join(', ')}`,
        `PEOPLE (with death years, never exceeded): ${sheet.hosts.map((h) => `${h.name} (dies ${h.deathYear})`).join('; ')}`,
        `OPEN RIPPLES: ${state.ripples.map((r) => `[${r.id}] Y${r.year}: ${r.text}`).join(' | ') || 'none'}`,
        `SEALED TRUTHS (stay consistent): ${state.sealedFacts.map((f) => f.text).join(' | ') || 'none'}`,
        `RECENT COMMITTED FACTS: ${state.facts.slice(-15).map((f) => `${f.actor} ${f.action} @${f.locationId}`).join('; ') || 'none'}`,
      ].join('\n\n'),
      maxTokens: 1200,
      summary: `settle years ${fromYear}–${toYear}`,
    });

    return {
      chronicle: typeof raw.chronicle === 'string' ? raw.chronicle : '',
      facts: (Array.isArray(raw.facts) ? raw.facts : []).map((f) => ({
        actor: String(f.actor ?? 'the town'),
        action: String(f.action ?? ''),
        target: f.target ? String(f.target) : undefined,
        locationId: sheet.locations.some((l) => l.id === f.locationId) ? f.locationId : sheet.locations[0].id,
        tags: (Array.isArray(f.tags) ? f.tags : []).map((t) => String(t).toLowerCase()),
      })),
      rippleResolutions: (Array.isArray(raw.rippleResolutions) ? raw.rippleResolutions : []).map((r) => ({
        rippleId: String(r.rippleId ?? ''),
        resolution: String(r.resolution ?? ''),
      })),
      sealedFacts: (Array.isArray(raw.sealedFacts) ? raw.sealedFacts : []).map((s) => ({
        text: String(s.text ?? ''),
        knownTo: (Array.isArray(s.knownTo) ? s.knownTo : []).map(String),
      })),
    };
  }

  async answerQuestion(ctx: SceneContext, question: string): Promise<string> {
    const recentFacts = ctx.state.facts.slice(-20);
    return this.client.complete({
      kind: 'storyteller',
      model: this.model(),
      system:
        'You are the continuous mind of the ANSELD player — an unbodied intelligence answering its own question. ' +
        'Answer ONLY from the knowledge and committed facts provided. You may connect and reason across them, but invent nothing new about the world. ' +
        'If the record is silent on the question, say so plainly — "the record is silent" is a complete answer. ' +
        '60–140 words, plain text, no JSON, the same cold spare voice as the telling.',
      user: [
        `WHAT THE PLAYER KNOWS: ${ctx.knowledge.length > 0 ? ctx.knowledge.join(' | ') : 'nothing recorded yet'}`,
        `COMMITTED FACTS: ${recentFacts.length > 0 ? recentFacts.map((f) => `${f.actor} ${f.action}${f.target ? ' → ' + f.target : ''} @${f.locationId}`).join('; ') : 'none'}`,
        `CURRENT HOST: ${ctx.host.name}, ${ctx.host.role}, Year ${ctx.year}.`,
        `THE QUESTION: ${question}`,
      ].join('\n\n'),
      maxTokens: 400,
      summary: `recollection: ${question.slice(0, 60)}`,
    });
  }

  private async call(ctx: SceneContext, playerAction: string | null): Promise<StorytellerTurn> {
    const tagVocabulary = [...new Set(ctx.state.prophecies.flatMap((p) => p.tags))].sort();
    const aimed = ctx.state.prophecies.filter((p) => p.state === 'aimed');
    const unaimed = ctx.state.prophecies.filter((p) => p.kind === 'loose' && (p.state === 'unaimed' || p.state === 'warned'));
    const recentFacts = ctx.state.facts.slice(-12);

    const user = [
      `TOWN: ${ctx.sheet.townName}. ${ctx.sheet.overview}`,
      `THE ANTAGONIST: ${ctx.sheet.antagonist.name}, ${ctx.sheet.antagonist.title}. ${ctx.sheet.antagonist.nature} They cannot be possessed, cannot be reasoned into ending, cannot be removed by force. They never defend themselves — cheaper villains parry. Osric Vane's Assize stands behind them, distant but implied.`,
      `YEAR: ${ctx.year}.`,
      `HOST: ${ctx.host.name}, ${ctx.host.role}, born Year ${ctx.host.birthYear} (dies before ${ctx.host.deathYear + 1}; never state this). Species: ${ctx.host.species}. ${ctx.host.seed}${ctx.host.watched ? ' THIS HOST IS WATCHED by the Assize — actions may be reported.' : ''}`,
      `CURRENT LOCATION: ${ctx.locationId}.`,
      `LOCATIONS (id — name, sealed?): ${ctx.sheet.locations.map((l) => `${l.id} — ${l.name}${l.sealed ? ' [SEALED]' : ''}`).join('; ')}`,
      `PEOPLE OF THE ERA: ${ctx.sheet.hosts.map((h) => `${h.name} (${h.role})`).join('; ')}`,
      `TAG VOCABULARY: ${tagVocabulary.join(', ')}`,
      aimed.length > 0
        ? `AIMED PROPHECIES (fate — bend toward these): ${aimed
            .map((p) => `"${p.poetic}" aimed: ${p.aimDeclaration} [${p.roles.map((r) => `${r.label}=${r.boundTo}`).join(', ')}]`)
            .join(' | ')}`
        : '',
      unaimed.length > 0 ? `UNAIMED PROPHECIES (in the world's grain, never quoted): ${unaimed.map((p) => `"${p.poetic}"`).join(' | ')}` : '',
      ctx.knowledge.length > 0 ? `WHAT THE PLAYER KNOWS (usable across any host): ${ctx.knowledge.join(' | ')}` : '',
      recentFacts.length > 0
        ? `RECENT COMMITTED FACTS: ${recentFacts.map((f) => `${f.actor} ${f.action}${f.target ? ' → ' + f.target : ''} @${f.locationId}`).join('; ')}`
        : 'RECENT COMMITTED FACTS: none — this is early in the telling.',
      ctx.state.sealedFacts.length > 0
        ? `SEALED TRUTHS (hidden from the player; never contradicted, never volunteered): ${ctx.state.sealedFacts
            .map((f) => `${f.text} [known to: ${f.knownTo.join(', ') || 'no one living'}]`)
            .join(' | ')}`
        : '',
      ctx.state.ripples.length > 0
        ? `OPEN RIPPLES (threads left running, not yet settled): ${ctx.state.ripples.map((r) => `Y${r.year}: ${r.text}`).join(' | ')}`
        : '',
      ctx.state.unwitnessed.length > 0
        ? `UNWITNESSED STRETCHES (overwritten time; the world is quietly wrong about these years): ${ctx.state.unwitnessed.map((u) => `${u.fromYear}–${u.toYear}`).join(', ')}`
        : '',
      ctx.directives.length > 0 ? `OSRIC DIRECTIVES:\n${ctx.directives.join('\n')}` : '',
      ctx.recentProse.length > 0 ? `PREVIOUS SCENE (for continuity of texture):\n${ctx.recentProse[ctx.recentProse.length - 1]}` : '',
      playerAction === null
        ? `TASK: The player has just arrived in this host (the telling begins already inhabited — a waking, mid-motion, no hovering). Write the arrival scene. Ground the player: the host is mid-task in their ordinary work, and something small but wrong — one concrete thread of the town's open wound — is in front of them or freshly on their mind. At least one choice must point toward that thread; the others toward the host's own business. Never explain the game; show the town.`
        : `PLAYER ACTION: ${playerAction}\nTASK: Narrate what happens. File the fact report honestly.`,
    ]
      .filter(Boolean)
      .join('\n\n');

    const turn = await this.client.completeJson<StorytellerTurn>({
      kind: 'storyteller',
      model: this.model(),
      system: STORYTELLER_SYSTEM,
      user,
      maxTokens: 1200,
      summary: playerAction === null ? `open scene: ${ctx.host.name} Y${ctx.year}` : `turn: ${playerAction.slice(0, 60)}`,
    });

    return sanitizeTurn(turn, ctx);
  }
}

/** The Referee's intake desk: malformed reports are corrected or discarded. */
export function sanitizeTurn(turn: StorytellerTurn, ctx: SceneContext): StorytellerTurn {
  const validLocations = new Set(ctx.sheet.locations.map((l) => l.id));
  const facts = (Array.isArray(turn.facts) ? turn.facts : [])
    .filter((f) => f && typeof f.action === 'string')
    .map((f) => ({
      actor: String(f.actor ?? ctx.host.name),
      action: String(f.action),
      target: f.target ? String(f.target) : undefined,
      locationId: validLocations.has(f.locationId) ? f.locationId : ctx.locationId,
      tags: (Array.isArray(f.tags) ? f.tags : []).map((t) => String(t).toLowerCase()),
    }));

  let choices = (Array.isArray(turn.choices) ? turn.choices : [])
    .filter((c) => c && typeof c.label === 'string')
    .slice(0, 4);
  if (choices.length === 0 && !turn.hostDied) {
    choices = [{ label: 'Wait, and watch' }];
  }

  return {
    prose: typeof turn.prose === 'string' && turn.prose.trim() ? turn.prose : '(The scene refuses to be written. Try again.)',
    facts,
    foreclosed: typeof turn.foreclosed === 'string' ? turn.foreclosed : '',
    choices,
    hostDied: turn.hostDied && typeof turn.hostDied.cause === 'string' ? { cause: turn.hostDied.cause } : undefined,
    knowledgeGained: (Array.isArray(turn.knowledgeGained) ? turn.knowledgeGained : []).map(String).filter((s) => s.trim()),
    sealedFacts: (Array.isArray(turn.sealedFacts) ? turn.sealedFacts : [])
      .filter((s) => s && typeof s.text === 'string' && s.text.trim())
      .map((s) => ({ text: s.text, knownTo: (Array.isArray(s.knownTo) ? s.knownTo : []).map(String) })),
    ripplesOpened: (Array.isArray(turn.ripplesOpened) ? turn.ripplesOpened : []).map(String).filter((s) => s.trim()),
  };
}

// ============================================================
// The Clerk — blind, narrow, incorruptible. Sees only the
// hidden face and the record excerpt. Defaults to "no".
// ============================================================

const CLERK_SYSTEM = `You are the Clerk of the Assize. You rule on exactly one question: does the committed record satisfy a prophecy's hidden fulfillment condition, LITERALLY as written?

You know nothing of the story. You are given only the condition, the role bindings, and the relevant committed facts. Rule strictly:
- Every clause of the condition must be satisfied by the facts. Poetic resemblance is not satisfaction.
- If bindings name specific people, the facts must involve exactly those people.
- When uncertain, rule NOT fulfilled. The count closes or it does not.

Respond with ONLY valid JSON: {"fulfilled": true/false, "reasoning": "one sentence citing the deciding fact or the missing clause"}`;

export class LiveClerk implements Clerk {
  constructor(
    private client: ClaudeClient,
    private model: () => string,
  ) {}

  async rule(prophecy: Prophecy, recordExcerpt: string): Promise<{ fulfilled: boolean; reasoning: string }> {
    const ruling = await this.client.completeJson<{ fulfilled: boolean; reasoning: string }>({
      kind: 'clerk',
      model: this.model(),
      system: CLERK_SYSTEM,
      user: `HIDDEN CONDITION: ${prophecy.hiddenCondition}\n\n${recordExcerpt}`,
      maxTokens: 300,
      summary: `clerk ruling: ${prophecy.id}`,
    });
    return {
      fulfilled: ruling.fulfilled === true,
      reasoning: typeof ruling.reasoning === 'string' ? ruling.reasoning : '',
    };
  }
}
