// ============================================================
// The locals of Gullshead — six people who have seen everything
// and are mostly worried about zoning — and the tourist mill:
// generated visitors with names, wants, and opinions they will
// absolutely be sharing with the mainland.
// ============================================================

import type { WantKind } from './world';

export interface ScheduleStop {
  at: number;
  placeId: string;
  activity: string;
}

export interface LocalDef {
  id: string;
  name: string;
  role: string;
  /** Voice bible: one line that every canned reply and AI prompt obeys. */
  voice: string;
  schedule: ScheduleStop[];
  look: { body: number; outfit: number };
  /** keyword → reply, for free mock conversations. First match wins. */
  answers: Array<{ keywords: string[]; reply: string }>;
  greeting: string;
}

export const LOCALS: LocalDef[] = [
  {
    id: 'captain', name: 'Captain Ferrick', role: 'Ferry captain',
    voice: 'Talks about the sea like an unreliable employee he cannot fire.',
    look: { body: 1, outfit: 1 },
    greeting: '“Mayor. Boat still floats. You’re welcome.”',
    schedule: [
      { at: 7, placeId: 'pier-end', activity: 'readying the ferry' },
      { at: 10, placeId: 'pier-top', activity: 'smoking thoughtfully' },
      { at: 14, placeId: 'pier-end', activity: 'pretending to fix a rope' },
      { at: 20, placeId: 'square', activity: 'evening rounds' },
      { at: 22, placeId: 'pier-top', activity: 'sleeping on the boat, by preference' },
    ],
    answers: [
      { keywords: ['tourist', 'visitor', 'ferry', 'mainland'], reply: '“I bring ’em, you keep ’em happy. That’s the whole economy, far as I can tell. Word travels fast over there — one bad crossing story and my boat comes back light.”' },
      { keywords: ['night', 'ghost', 'curse', 'strange'], reply: '“I sleep on the boat. On the WATER. You want to know why? No. You don’t.”' },
      { keywords: ['choir', 'singing', 'beach'], reply: '“Some nights the water sings. I hum something else over it. Works for me.”' },
    ],
  },
  {
    id: 'petra', name: 'Petra Vane', role: 'Innkeeper (of a boarded-up inn)',
    voice: 'Aggressively hospitable with nothing to be hospitable in.',
    look: { body: 2, outfit: 2 },
    greeting: '“Mayor! Wonderful day. My inn has no roof over half of it. Just wonderful.”',
    schedule: [
      { at: 8, placeId: 'main-street', activity: 'sweeping in front of the inn' },
      { at: 12, placeId: 'square', activity: 'lunch on a bench' },
      { at: 13, placeId: 'main-street', activity: 'sweeping, again' },
      { at: 21, placeId: 'square', activity: 'evening air' },
      { at: 23, placeId: 'main-street', activity: 'home' },
    ],
    answers: [
      { keywords: ['inn', 'sleep', 'bed', 'rest'], reply: '“Fix my inn and I will make those tourists so comfortable they won’t look out a window all night. That is a professional guarantee, Mayor.”' },
      { keywords: ['night', 'ghost', 'curse'], reply: '“A guest once asked about the crying from the walls. I said pipes. It was not pipes, Mayor, but it also wasn’t her business.”' },
    ],
  },
  {
    id: 'osmund', name: 'Osmund Groat', role: 'Cook',
    voice: 'Believes chowder solves everything, has yet to be proven wrong.',
    look: { body: 3, outfit: 3 },
    greeting: '“Mayor. Hungry? Everyone’s hungry. It’s my one advantage.”',
    schedule: [
      { at: 7, placeId: 'square', activity: 'setting up the soup cart' },
      { at: 16, placeId: 'main-street', activity: 'buying fish' },
      { at: 19, placeId: 'square', activity: 'packing the cart' },
      { at: 22, placeId: 'main-street', activity: 'home' },
    ],
    answers: [
      { keywords: ['food', 'chowder', 'eat'], reply: '“Rebuild the Chowder House and I’ll have tourists writing poems. Chowder poems. The mainland loves poems.”' },
      { keywords: ['night', 'ghost', 'curse'], reply: '“Whatever walks the north lane at night, it has never once ordered soup. So it’s no customer of mine, and I don’t speak ill of non-customers. Or think about them. At all.”' },
    ],
  },
  {
    id: 'hobb', name: 'Hobb Naylor', role: 'Handyman',
    voice: 'Quotes everything in nails and days; spooked by nothing except paperwork.',
    look: { body: 4, outfit: 4 },
    greeting: '“Mayor. Point at a ruin, I’ll point at a price.”',
    schedule: [
      { at: 8, placeId: 'main-street', activity: 'looking at a wall, professionally' },
      { at: 12, placeId: 'square', activity: 'lunch' },
      { at: 13, placeId: 'street-east', activity: 'measuring something' },
      { at: 21, placeId: 'main-street', activity: 'home' },
    ],
    answers: [
      { keywords: ['build', 'repair', 'fix', 'cost'], reply: '“Post it on the notice board, Mayor. Board says build, I build. Board says nothing, I stand here looking at this wall. Democracy.”' },
      { keywords: ['night', 'ghost', 'curse'], reply: '“I did a quote for the weeping house once. The crying stopped while I measured. Rude, honestly — I was nearly done.”' },
    ],
  },
  {
    id: 'edda', name: 'Old Edda', role: 'Retired everything',
    voice: 'Gossip with the range of a lighthouse and half the accuracy.',
    look: { body: 5, outfit: 5 },
    greeting: '“Mayor! Sit. I know things. Most of them are even true.”',
    schedule: [
      { at: 9, placeId: 'square', activity: 'holding court on a bench' },
      { at: 13, placeId: 'main-street', activity: 'inspecting other people’s business' },
      { at: 17, placeId: 'square', activity: 'bench, second shift' },
      { at: 21, placeId: 'main-street', activity: 'home' },
    ],
    answers: [
      { keywords: ['walker', 'lantern', 'light', 'lane'], reply: '“The lantern walks every third night, regular as rent. Chapel to lighthouse, never varies. My grandmother said salt across the lane turns it back. My grandmother also salted her tea, so weigh that as you like.”' },
      { keywords: ['night', 'ghost', 'curse', 'strange'], reply: '“Cursed? Tsk. The island’s not cursed, it’s HAUNTED. Cursed is when the ferry’s late. Ask Maren at the lighthouse if you want the old stories — she keeps them like preserves.”' },
      { keywords: ['maren', 'lighthouse', 'keeper'], reply: '“Maren’s kept that light for fifty years and never once needed the stairs explained to her, if you follow me. She knows the nights by name.”' },
    ],
  },
  {
    id: 'maren', name: 'Maren Sill', role: 'Lighthouse keeper',
    voice: 'Says one true thing per conversation and charges you the rest in silence.',
    look: { body: 6, outfit: 0 },
    greeting: '“Mayor. Long climb for a visit. Say your piece.”',
    schedule: [
      { at: 6, placeId: 'lighthouse', activity: 'tending the light' },
      { at: 15, placeId: 'lighthouse-door', activity: 'watching the water' },
      { at: 19, placeId: 'lighthouse', activity: 'tending the light' },
    ],
    answers: [
      { keywords: ['choir', 'singing', 'beach', 'water'], reply: '“The choir rises on fog nights. They rose the year the bell went quiet, and they’ve risen since. Ring the old chapel bell before nine of an evening and they keep to the bottom. They only want to be told someone remembers.”' },
      { keywords: ['walker', 'lantern'], reply: '“The lantern walks to the light because the light is the only thing older than it is. Salt on the lane stops it. It’s not proud.”' },
      { keywords: ['night', 'ghost', 'curse', 'weep', 'house'], reply: '“The island keeps its dead like the museum keeps exhibits — behind glass, mostly. Mostly. Come back when you’ve seen one and I’ll tell you what you saw.”' },
    ],
  },
];

// ---------------- Tourists ----------------

export interface TouristDef {
  id: string;
  name: string;
  wants: WantKind[];
  /** One-line disposition, for talk lines and reviews. */
  temper: string;
  look: { body: number; outfit: number };
}

const FIRST = ['Mabel', 'Gordon', 'Prudence', 'Bertram', 'Winnie', 'Clement', 'Dot', 'Horace', 'Sybil', 'Ned', 'Agnes', 'Percy', 'Flo', 'Basil', 'Ida'];
const LAST = ['Fitch', 'Prue', 'Womble', 'Cransley', 'Puddock', 'Marsh', 'Tibbet', 'Gorse', 'Quill', 'Dunning', 'Spratt', 'Hollow'];
const TEMPERS = [
  'documents everything for the folks back home',
  'came for one thing and will not be flexible about it',
  'frightens easily and narrates it loudly',
  'skeptical of islands generally',
  'on doctor’s orders to relax, resents it',
  'honeymooning, alone, don’t ask',
  'collects postcards of places that disappoint',
  'believes weather is a personal matter',
];
const WANTS: WantKind[] = ['food', 'fun', 'history', 'rest'];

let touristCounter = 0;

/** Deterministic-ish generation from a seed so tests can pin behavior. */
export function makeTourist(seed: number): TouristDef {
  touristCounter += 1;
  const pick = <T>(arr: T[], n: number) => arr[Math.abs(n) % arr.length];
  const wants: WantKind[] = [pick(WANTS, seed)];
  if (seed % 3 === 0) {
    const second = pick(WANTS, seed >> 2);
    if (second !== wants[0]) wants.push(second);
  }
  return {
    id: `tourist-${touristCounter}`,
    name: `${pick(FIRST, seed)} ${pick(LAST, seed >> 3)}`,
    wants,
    temper: pick(TEMPERS, seed >> 5),
    look: { body: seed % 8, outfit: (seed >> 3) % 6 },
  };
}

export function currentStop(schedule: ScheduleStop[], hourF: number): ScheduleStop {
  const sorted = [...schedule].sort((a, b) => a.at - b.at);
  let active = sorted[sorted.length - 1];
  for (const stop of sorted) {
    if (hourF >= stop.at) active = stop;
  }
  return active;
}
