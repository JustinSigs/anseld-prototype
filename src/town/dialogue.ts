// ============================================================
// Words at the point of attention. Mock mode: canned, free,
// deterministic. Live mode: one short AI call — people answer
// the body they see, not the thing inside it. Animals cannot
// converse: comprehension was traded for access.
// ============================================================

import type { AgentState, TownSim } from './sim';
import { ClaudeClient } from '../ai/client';

const TOWN_BRIEF =
  'Saltmere, a piling-town on the Grey Lake in the kingdom of Anseld. The Assize counts everything; nobody lives past fifty; the salt-garden fails a little more each year and nobody says why.';

export interface DialogueProvider {
  talk(sim: TownSim, target: AgentState): Promise<string>;
  overhear(sim: TownSim, a: AgentState, b: AgentState): Promise<string>;
}

export class MockDialogue implements DialogueProvider {
  async talk(sim: TownSim, target: AgentState): Promise<string> {
    const player = sim.player();
    if (player.def.species !== 'human') {
      return `${target.def.name} glances at the ${player.def.species} and goes back to ${target.activity}. People do not converse with vermin.`;
    }
    const h = sim.clock.hour;
    const daypart = h < 11 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
    return `${target.def.name} pauses their ${target.activity}. “${daypart === 'morning' ? 'Early for talk' : daypart === 'afternoon' ? 'Salt waits for no one' : 'The lamp is low'}, ${player.def.name.split(' ')[0]}.” ${target.def.seed}`;
  }

  async overhear(_sim: TownSim, a: AgentState, b: AgentState): Promise<string> {
    return `${a.def.name} murmurs to ${b.def.name}: “…the count doesn't close, I'm telling you. It hasn't closed since the pans went short…”`;
  }
}

export class LiveDialogue implements DialogueProvider {
  constructor(
    private client: ClaudeClient,
    private model: () => string,
  ) {}

  async talk(sim: TownSim, target: AgentState): Promise<string> {
    const player = sim.player();
    if (player.def.species !== 'human') {
      return `${target.def.name} glances at the ${player.def.species} and goes back to ${target.activity}.`;
    }
    return this.client.complete({
      kind: 'storyteller',
      model: this.model(),
      system:
        `You voice one inhabitant of ${TOWN_BRIEF} Reply with 2-4 spare, in-character sentences of spoken dialogue plus at most one short action beat. No melodrama. They speak to the person in front of them and know nothing of possession.`,
      user: [
        `YOU ARE: ${target.def.name}, ${target.def.role}. ${target.def.seed} Currently: ${target.activity}.`,
        `TIME: ${sim.clock.label}.`,
        `SPEAKING TO: ${player.def.name}, ${player.def.role} — react to who THEY are in this town.`,
      ].join('\n'),
      maxTokens: 200,
      summary: `town talk: ${target.def.id}`,
    });
  }

  async overhear(sim: TownSim, a: AgentState, b: AgentState): Promise<string> {
    return this.client.complete({
      kind: 'storyteller',
      model: this.model(),
      system: `You write one overheard fragment of conversation in ${TOWN_BRIEF} One to two sentences of murmured speech, mid-conversation, spare and concrete. Format: NAME murmurs to NAME: “…fragment…”`,
      user: `${a.def.name} (${a.def.role}; ${a.def.seed}) and ${b.def.name} (${b.def.role}; ${b.def.seed}), ${sim.clock.label}, both ${a.activity}.`,
      maxTokens: 120,
      summary: `overheard: ${a.def.id}+${b.def.id}`,
    });
  }
}
