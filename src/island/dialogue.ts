// ============================================================
// Words on Gullshead. Mock mode: keyword tables from each
// local's voice bible — free and deterministic. Live mode: AI
// in character, carrying the tone contract (deadpan municipal
// comedy; the ghosts themselves are never funny).
// ============================================================

import type { IslandSim, LocalState, TouristState } from './sim';
import { WANT_LABEL } from './economy';
import { ClaudeClient } from '../ai/client';

const TONE_CONTRACT =
  'Tone: quirky, deadpan, small-town municipal comedy. Locals are unbothered by the supernatural and mostly concerned with practical matters. Tourists are dramatic. The supernatural itself is treated as genuinely eerie — the comedy lives in how people react to it, never in the ghosts being silly. 2-4 sentences, spoken voice, no melodrama.';

export interface IslandDialogue {
  talk(sim: IslandSim, target: LocalState | TouristState, playerLine?: string): Promise<string>;
}

function isLocal(t: LocalState | TouristState): t is LocalState {
  return 'answers' in t.def;
}

export class MockIslandDialogue implements IslandDialogue {
  async talk(_sim: IslandSim, target: LocalState | TouristState, playerLine?: string): Promise<string> {
    if (isLocal(target)) {
      if (playerLine) {
        const line = playerLine.toLowerCase();
        for (const a of target.def.answers) {
          if (a.keywords.some((k) => line.includes(k))) return a.reply;
        }
        return `${target.def.name} considers that. “Couldn’t say, Mayor. Have you asked Old Edda? She says enough for the whole island.”`;
      }
      return target.def.greeting;
    }
    // A tourist.
    const t = target as TouristState;
    const unmet = t.def.wants.filter((w) => !t.wantsMet.includes(w));
    if (t.scared) return `“MAYOR. I saw— there was— I am LEAVING on the first boat and I am TELLING PEOPLE.” (${t.def.name} does not appear open to follow-up questions.)`;
    if (unmet.length > 0) return `“Lovely island, I suppose. Though I did come for ${WANT_LABEL[unmet[0]]}, and so far it’s mostly… gulls.” (${t.def.name} — ${t.def.temper}.)`;
    return `“Having a wonderful time, Mayor! Everything I wanted. I shall say so, loudly, at home.” (${t.def.name} beams.)`;
  }
}

export class LiveIslandDialogue implements IslandDialogue {
  constructor(
    private client: ClaudeClient,
    private model: () => string,
  ) {}

  async talk(sim: IslandSim, target: LocalState | TouristState, playerLine?: string): Promise<string> {
    const who = isLocal(target)
      ? `${target.def.name}, ${target.def.role}. Voice: ${target.def.voice}. What they know (guard it like a person with motives, hint rather than lecture): ${target.def.answers.map((a) => a.reply).join(' | ')}`
      : `${(target as TouristState).def.name}, a tourist (${(target as TouristState).def.temper}). Wants: ${(target as TouristState).def.wants.join(', ')}. Wants met so far: ${(target as TouristState).wantsMet.join(', ') || 'none'}. ${(target as TouristState).scared ? 'They witnessed something supernatural last night and are terrified and furious.' : ''}`;

    return this.client.complete({
      kind: 'storyteller',
      model: this.model(),
      system: `You voice one person on Gullshead Island — a run-down tourist island whose mayor (the player) is trying to revive it, and which is quietly haunted at night. ${TONE_CONTRACT}`,
      user: [
        `YOU ARE: ${who}`,
        `TIME: ${sim.clock.label}. Treasury rumors: the mayor has been ${sim.treasury < 20 ? 'pinching coins' : 'spending'} lately.`,
        playerLine ? `THE MAYOR SAYS TO YOU: "${playerLine}"` : 'The mayor approaches. Greet them in character.',
      ].join('\n'),
      maxTokens: 220,
      summary: `island talk: ${target.def.name}`,
    });
  }
}
