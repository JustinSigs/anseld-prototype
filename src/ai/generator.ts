// ============================================================
// The Run Generator — deals a fresh era at run start:
// town, hosts, prime prophecy (the win), loose prophecies.
// Every prophecy is born with both faces and its sealed sketch.
// Code validates everything; the fifty-year ceiling is clamped,
// never trusted.
// ============================================================

import type { Dials, EraSheet, Host, Location, Prophecy } from '../core/types';
import { ClaudeClient } from './client';

const GENERATOR_SYSTEM = `You generate a self-contained 15-year era for ANSELD: a grim, quiet fantasy kingdom on a salt lake, ruled from afar by Osric Vane, the Forever King, whose Assize (Tallymen) keeps the Ledger. Nobody lives past fifty. Tone: cold, precise, administrative dread. Names are short, worn, Germanic-adjacent (Merra, Corb, Dovan, Issa, Halloran, Sess, Wren).

You must produce prophecies with TWO FACES each:
- "poetic": one evocative sentence the player sees. Concrete nouns, no abstractions.
- "hiddenCondition": the precise, checkable fulfillment condition, beginning "Fulfilled when:". Written so a clerk with only a list of facts could rule yes/no. It must be literally satisfiable through play in this town within the era.
- "roles": the blanks in the sentence, e.g. "the drowned man" — 1 or 2 per prophecy.
- "tags": 3-5 lowercase single words naming the prophecy's subjects (used for contact detection). LOOSE prophecies must not share ANY tag with each other — each must live in its own distinct corner of the town's life, so ordinary work near one subject never brushes two prophecies at once.
- "sealedSketch" (loose prophecies only): one sentence beginning "If neglected:" describing the careless, usually harmful way the world resolves it on its own.

The era also has SEALED TRUTHS: 2-4 hidden facts fixed now, before play — who or what is really behind the town's open wound, what the antagonist is actually doing, who did the unexplained deliberate things. Written as plain factual sentences. Each lists "knownTo": the era people (by name) who know that truth. These are the answers the player can dig for; a mystery with no committed answer is forbidden.

The era has an ANTAGONIST: a forever-king-shaped figure in miniature — a local authority who holds the town and cannot be ended by ordinary means. Like Osric Vane himself, they cannot be possessed, cannot be reasoned into ending, and cannot be removed by force; only the prime prophecy ends them. Give them one local unexplained fact (their "nature") in the manner of the fifty-year ceiling: concrete, quiet, never explained.

The PRIME prophecy is the run's win condition: the antagonist "cannot fall while X" until 3 conditions are met. Its conditions must require genuinely different kinds of work (public acts, physical acts, documents), each achievable but none trivial, and each must plausibly loosen the antagonist's grip.

Respond with ONLY valid JSON, no code fences:
{
  "townName": "...",
  "overview": "3-4 sentences: the town, its industry, its Assize presence, its open wound",
  "antagonist": {"name": "...", "title": "the ... of <town>", "nature": "2 sentences: what they are, and the quiet unexplained fact that makes ordinary means useless"},
  "locations": [6 items: {"id": "kebab-case", "name": "...", "sealed": false, "description": "one line"} — EXACTLY ONE location has "sealed": true, a place no adult human fits or is permitted],
  "hosts": [8 humans: {"id": "kebab-case", "name": "...", "birthYear": n, "deathYear": n, "role": "...", "homeLocation": "a location id", "seed": "one line of situation/personality"} — every human alive for at least part of the era, deathYear at most birthYear+50, at least two dying DURING the era],
  "sealedTruths": [2-4 items: {"text": "the hidden fact, plainly stated", "knownTo": ["host names who know it"]}],
  "primePoetic": "the framing sentence of the prime prophecy",
  "primeConditions": [3 items: {"id": "prime-1..3", "poetic": "...", "hiddenCondition": "...", "roles": [{"label": "..."}], "tags": [...]}],
  "looseProphecies": [N items: {"id": "loose-1..N", "poetic": "...", "hiddenCondition": "...", "roles": [{"label": "..."}], "tags": [...], "sealedSketch": "..."}]
}`;

interface RawSheet {
  townName: string;
  overview: string;
  antagonist?: { name: string; title: string; nature: string };
  sealedTruths?: Array<{ text: string; knownTo: string[] }>;
  locations: Array<{ id: string; name: string; sealed: boolean; description: string }>;
  hosts: Array<{ id: string; name: string; birthYear: number; deathYear: number; role: string; homeLocation: string; seed: string }>;
  primePoetic: string;
  primeConditions: Array<{ id: string; poetic: string; hiddenCondition: string; roles: Array<{ label: string }>; tags: string[] }>;
  looseProphecies: Array<{ id: string; poetic: string; hiddenCondition: string; roles: Array<{ label: string }>; tags: string[]; sealedSketch: string }>;
}

const ERA_START = 60;
const ERA_END = 75;

export async function generateEraSheet(client: ClaudeClient, dials: Dials): Promise<EraSheet> {
  let lastError = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await client.completeJson<RawSheet>({
      kind: 'generator',
      model: dials.generatorModel,
      system: GENERATOR_SYSTEM,
      user:
        `Generate the era. Years ${ERA_START}–${ERA_END}. Loose prophecy count: ${dials.looseProphecyCount}. ` +
        `Make the town's open wound connect to at least one prime condition. Keep every description and seed to a single line — the JSON must stay compact.` +
        (lastError ? `\n\nYour previous era was rejected by the Referee: ${lastError}. Generate a corrected era.` : ''),
      maxTokens: 8000,
      summary: attempt === 0 ? 'generate era sheet' : 'generate era sheet (rejected, retry)',
    });
    try {
      return validateSheet(raw);
    } catch (err) {
      lastError = String(err).slice(0, 300);
    }
  }
  throw new Error(`The era refused to validate twice: ${lastError}`);
}

/** The Referee's intake for generated worlds: clamp, repair, or throw. */
export function validateSheet(raw: RawSheet): EraSheet {
  if (!raw.townName || !Array.isArray(raw.locations) || !Array.isArray(raw.hosts)) {
    throw new Error('Generated era sheet is missing required parts.');
  }

  // Locations: exactly one sealed; art assigned by index from the fixed shelf.
  const locations: Location[] = raw.locations.slice(0, 8).map((l, i) => ({
    id: l.id,
    name: l.name,
    sealed: Boolean(l.sealed),
    description: l.description ?? '',
    roomArtId: `room-${(i % 8) + 1}`,
  }));
  if (!locations.some((l) => l.sealed)) locations[locations.length - 1].sealed = true;
  const firstSealed = locations.findIndex((l) => l.sealed);
  locations.forEach((l, i) => {
    if (i !== firstSealed) l.sealed = false;
  });
  const locIds = new Set(locations.map((l) => l.id));
  const fallbackLoc = locations.find((l) => !l.sealed)!.id;

  // Humans: the fifty-year ceiling is law, not a suggestion.
  const humans: Host[] = raw.hosts.slice(0, 12).map((h, i) => {
    const birthYear = clampInt(h.birthYear, ERA_START - 49, ERA_END);
    let deathYear = clampInt(h.deathYear, birthYear + 1, birthYear + 50);
    if (deathYear < ERA_START) deathYear = ERA_START + 1; // must touch the era
    return {
      id: h.id || `host-${i + 1}`,
      name: h.name,
      species: 'human' as const,
      birthYear,
      deathYear,
      role: h.role ?? '',
      homeLocation: locIds.has(h.homeLocation) ? h.homeLocation : fallbackLoc,
      portraitId: `face-${(i % 12) + 1}`,
      seed: h.seed ?? '',
      watched: false,
    };
  });

  // The animal hosts are always available: access without comprehension.
  const sealedLoc = locations[firstSealed];
  const animals: Host[] = [
    {
      id: 'raven-1', name: 'A ledger-raven', species: 'raven',
      birthYear: ERA_START - 5, deathYear: ERA_START + 35,
      role: 'Assize raven', homeLocation: fallbackLoc, portraitId: 'face-raven',
      seed: 'Wears a numbered band. Nobody remembers banding it.', watched: false,
    },
    {
      id: 'rat-1', name: 'A dock rat', species: 'rat',
      birthYear: ERA_START + 2, deathYear: ERA_START + 5,
      role: 'Rat', homeLocation: sealedLoc.id, portraitId: 'face-rat',
      seed: 'Small enough for the spaces the Assize forgot to seal.', watched: false,
    },
  ];

  const mkProphecy = (
    p: { id: string; poetic: string; hiddenCondition: string; roles: Array<{ label: string }>; tags: string[]; sealedSketch?: string },
    kind: 'prime' | 'loose',
  ): Prophecy => ({
    id: p.id,
    kind,
    poetic: p.poetic,
    hiddenCondition: p.hiddenCondition,
    roles: (p.roles ?? []).slice(0, 3).map((r) => ({ label: r.label, boundTo: null, penciled: false })),
    tags: (p.tags ?? []).map((t) => String(t).toLowerCase()).slice(0, 6),
    sealedSketch: p.sealedSketch ?? '',
    state: 'unaimed',
    contacts: 0,
    aimDeclaration: null,
  });

  const primeConditions = (raw.primeConditions ?? []).slice(0, 4).map((p, i) => mkProphecy({ ...p, id: p.id || `prime-${i + 1}` }, 'prime'));
  const looseProphecies = (raw.looseProphecies ?? []).map((p, i) => mkProphecy({ ...p, id: p.id || `loose-${i + 1}` }, 'loose'));
  if (primeConditions.length < 3) throw new Error('Generated era lacks a full prime prophecy.');
  if (looseProphecies.length === 0) throw new Error('Generated era lacks loose prophecies.');

  // Loose prophecies must not share tags: shared tags mean one scene burns
  // several prophecies at once, which play has proven ruinous.
  const seenTags = new Set<string>();
  for (const p of looseProphecies) {
    p.tags = p.tags.filter((t) => !seenTags.has(t));
    if (p.tags.length === 0) throw new Error(`Loose prophecy ${p.id} has no unique tags — loose prophecies must not share subjects.`);
    for (const t of p.tags) seenTags.add(t);
  }

  // Unique ids or the Ledger cannot count.
  const ids = new Set<string>();
  for (const x of [...locations, ...humans, ...animals, ...primeConditions, ...looseProphecies]) {
    if (ids.has(x.id)) throw new Error(`Duplicate id in generated era: ${x.id}`);
    ids.add(x.id);
  }

  return {
    townName: raw.townName,
    eraStart: ERA_START,
    eraEnd: ERA_END,
    overview: raw.overview ?? '',
    antagonist: {
      name: raw.antagonist?.name ?? 'The Warden',
      title: raw.antagonist?.title ?? `the Warden of ${raw.townName}`,
      nature: raw.antagonist?.nature ?? 'The count keeps them, and no one remembers a time it did not.',
    },
    sealedTruths: (raw.sealedTruths ?? []).slice(0, 6).map((t) => ({
      text: String(t.text ?? ''),
      knownTo: (Array.isArray(t.knownTo) ? t.knownTo : []).map(String),
    })).filter((t) => t.text.trim()),
    locations,
    hosts: [...humans, ...animals],
    primePoetic: raw.primePoetic ?? '',
    primeConditions,
    looseProphecies,
  };
}

function clampInt(n: unknown, lo: number, hi: number): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : lo;
  return Math.max(lo, Math.min(hi, v));
}
