// ============================================================
// The Resolver — turns a described body into a concrete host.
// "The person nearest the Weighmistress when the rope was cut"
// becomes someone real: an existing host, or a new one committed
// to the era. Enforces the Oracle Rule: descriptions that can
// only be resolved by revealing an unlearned sealed truth are
// refused — flesh is found by what you know.
// ============================================================

import type { PossessionResolver, ResolvedPossession } from '../game/engine';
import type { EraSheet, WorldState } from '../core/types';
import { ClaudeClient } from './client';

const RESOLVER_SYSTEM = `You resolve possession requests in ANSELD. The player, an unbodied intelligence, describes a body to enter; you decide who that is.

Rules, in order:
1. If the description plausibly points at an existing named host, pick them.
2. If it describes someone who must exist but is not named (a bystander, a witness by position, a worker), INVENT them minimally: short worn name, role, plausible birth/death years (humans NEVER live past fifty years of age), a home location from the given ids, one line of seed. They become permanently real.
3. THE ORACLE RULE: if the description can only be resolved by using a SEALED TRUTH the player has not learned (e.g. "whoever cut the rope" when the cutter's identity is sealed and unknown to the player), you MUST refuse, with a short in-world reason. Descriptions by observable criteria (position, time, role, appearance) are always fair; descriptions that name the answer to a mystery are not.
4. If the description implies a time, resolve the year (within the era). Otherwise use the current year.
5. Species may be raven or rat if the description clearly asks for a creature; otherwise human.

Respond with ONLY valid JSON, one of:
{"kind":"existing","hostId":"...","year":n,"reasoning":"one line: who this is and why"}
{"kind":"new","year":n,"reasoning":"one line","host":{"name":"...","species":"human","birthYear":n,"deathYear":n,"role":"...","homeLocation":"a location id","seed":"one line"}}
{"kind":"refused","reason":"one in-world line"}`;

export class LiveResolver implements PossessionResolver {
  constructor(
    private client: ClaudeClient,
    private model: () => string,
  ) {}

  async resolve(params: { sheet: EraSheet; state: WorldState; description: string; currentYear: number }): Promise<ResolvedPossession> {
    const { sheet, state, description, currentYear } = params;
    const result = await this.client.completeJson<ResolvedPossession>({
      kind: 'clerk',
      model: this.model(),
      system: RESOLVER_SYSTEM,
      user: [
        `ERA: ${sheet.townName}, Years ${sheet.eraStart}–${sheet.eraEnd}. Current year: ${currentYear}.`,
        `HOSTS: ${sheet.hosts.map((h) => `${h.id} — ${h.name}, ${h.role}, ${h.species}, alive ${h.birthYear}–${h.deathYear}, home ${h.homeLocation}`).join('; ')}`,
        `LOCATION IDS: ${sheet.locations.map((l) => l.id).join(', ')}`,
        `SEALED TRUTHS (for the Oracle Rule — the player does NOT know these unless they appear in knowledge below): ${state.sealedFacts.map((f) => f.text).join(' | ') || 'none'}`,
        `WHAT THE PLAYER KNOWS: ${state.knowledge.join(' | ') || 'nothing recorded'}`,
        `RECENT COMMITTED FACTS: ${state.facts.slice(-12).map((f) => `${f.actor} ${f.action} @${f.locationId}`).join('; ') || 'none'}`,
        `THE DESCRIPTION: ${description}`,
      ].join('\n\n'),
      maxTokens: 500,
      summary: `resolve body: ${description.slice(0, 60)}`,
    });

    if (result && (result.kind === 'existing' || result.kind === 'new' || result.kind === 'refused')) return result;
    return { kind: 'refused', reason: 'The description found no purchase in this era.' };
  }
}

/** Mock: matches names/roles verbatim; invents nothing; refuses the rest. */
export class MockResolver implements PossessionResolver {
  async resolve(params: { sheet: EraSheet; state: WorldState; description: string; currentYear: number }): Promise<ResolvedPossession> {
    const d = params.description.toLowerCase();
    const match = params.sheet.hosts.find((h) => d.includes(h.name.toLowerCase()) || (h.role && d.includes(h.role.toLowerCase())));
    if (match) {
      return { kind: 'existing', hostId: match.id, year: params.currentYear, reasoning: `The description points at ${match.name}.` };
    }
    return { kind: 'refused', reason: 'The mock town knows only its named people. A live run resolves strangers.' };
  }
}
