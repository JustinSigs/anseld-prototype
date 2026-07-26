// ============================================================
// Mock storyteller + mock clerk — deterministic, zero-cost.
// Lets the Referee, rewinds, scars, and prophecy machinery be
// exercised end-to-end without a single AI call.
// Keyword-driven: the mock reacts to words in the player action.
// ============================================================

import type { Clerk, SceneContext, Storyteller } from '../game/engine';
import type { Prophecy, StorytellerTurn } from '../core/types';

export class MockStoryteller implements Storyteller {
  async openScene(ctx: SceneContext): Promise<StorytellerTurn> {
    return {
      prose:
        `Year ${ctx.year}. You wake as ${ctx.host.name}, ${ctx.host.role}, in ${this.locName(ctx, ctx.locationId)}. ` +
        `${ctx.host.seed} ` +
        (ctx.directives.length > 0 ? '(The Assize feels closer than it should.)' : ''),
      facts: [],
      foreclosed: '',
      choices: [
        { label: 'Take stock of the room' },
        { label: 'Work the ferry crossing' },
        { label: 'Study the local ledger' },
        { label: 'Confront the Warden' },
      ],
    };
  }

  async playTurn(ctx: SceneContext, playerAction: string): Promise<StorytellerTurn> {
    const a = playerAction.toLowerCase();
    const here = ctx.locationId;
    const name = ctx.host.name;

    if (a.includes('ferry') || a.includes('cross')) {
      return {
        prose: `${name} works a crossing. The Grey Lake gives back nothing it is owed.`,
        facts: [{ actor: name, action: 'made a ferry crossing', locationId: 'ferry-dock', tags: ['ferry', 'crossing'] }],
        foreclosed: 'The morning audit at the office went unwatched.',
        choices: [{ label: 'Work the ferry crossing' }, { label: 'Study the local ledger' }, { label: 'Confront the Warden' }],
      };
    }

    if (a.includes('confront')) {
      return {
        prose: `${name} names the Warden's count a lie to his face. The Assize does not argue. It seizes.`,
        facts: [{ actor: name, action: 'confronted the Warden publicly', target: 'the Warden', locationId: here, tags: ['warden', 'public'] }],
        foreclosed: 'A quiet approach to the Warden. He knows your face now — every face you wore near him.',
        choices: [],
        hostDied: { cause: 'seized by the Assize and not returned' },
        knowledgeGained: ['The Warden signs seizure orders without reading them.'],
      };
    }

    if (a.includes('study') || a.includes('ledger')) {
      return {
        prose: `${name} reads until the lamp gutters. Three folios carry sums that do not close.`,
        facts: [{ actor: name, action: 'studied the local ledger', locationId: 'assize-office', tags: ['ledger', 'folio'] }],
        foreclosed: '',
        choices: [{ label: 'Read the folio aloud on the dock' }, { label: 'Work the ferry crossing' }, { label: 'Confront the Warden' }],
        knowledgeGained: ['Three Saltmere folios carry sums that do not close.'],
      };
    }

    if (a.includes('read') && (a.includes('aloud') || a.includes('dock'))) {
      return {
        prose: `${name} stands on the dock at noon and reads the folio to anyone the wind allows. Someone stays to listen.`,
        facts: [
          { actor: name, action: 'read an Assize folio aloud, publicly, witnessed', locationId: 'ferry-dock', tags: ['folio', 'reading', 'dock', 'public'] },
        ],
        foreclosed: 'Anonymity on the dock. The listeners remember the reader.',
        choices: [{ label: 'Work the ferry crossing' }, { label: 'Study the local ledger' }],
      };
    }

    return {
      prose: `${name} moves through ${this.locName(ctx, here)} without leaving much of a mark.`,
      facts: [{ actor: name, action: 'passed the hour quietly', locationId: here, tags: [] }],
      foreclosed: '',
      choices: [{ label: 'Work the ferry crossing' }, { label: 'Study the local ledger' }, { label: 'Confront the Warden' }],
    };
  }

  private locName(ctx: SceneContext, id: string): string {
    return ctx.sheet.locations.find((l) => l.id === id)?.name ?? id;
  }
}

/**
 * Mock clerk: rules "fulfilled" only for prophecy ids in `fulfillOn`.
 * Tests control exactly which rulings succeed.
 */
export class MockClerk implements Clerk {
  constructor(private fulfillOn: Set<string> = new Set()) {}

  async rule(prophecy: Prophecy, _recordExcerpt: string): Promise<{ fulfilled: boolean; reasoning: string }> {
    if (this.fulfillOn.has(prophecy.id)) {
      return { fulfilled: true, reasoning: 'The record satisfies the hidden face, literally as written.' };
    }
    return { fulfilled: false, reasoning: 'The record does not yet satisfy the hidden face.' };
  }
}
