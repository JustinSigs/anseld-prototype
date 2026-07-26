// A small, fixed era sheet used by tests and by mock (no-AI) mode.
// In live mode the run generator produces a sheet of this same shape.

import type { EraSheet } from '../core/types';

export const FIXTURE_SHEET: EraSheet = {
  townName: 'Saltmere',
  eraStart: 60,
  eraEnd: 75,
  overview:
    'Saltmere, a piling-town on the Grey Lake, Years 60–75. One Assize office keeps the local Ledger. ' +
    'The salt-garden fails a little more each year and nobody will say why. The ferry runs short two crossings a week.',
  antagonist: {
    name: 'Halden Vosse',
    title: 'the Salt-Warden of Saltmere',
    nature:
      'He has kept the count for thirty-one years and the count keeps him. His folio has no birth line. ' +
      'Audits close around him like water; no discrepancy has ever been traced past his desk.',
  },
  locations: [
    { id: 'assize-office', name: 'The Assize Office', roomArtId: 'room-office', sealed: false, description: 'Ledgers, ink, one high window.' },
    { id: 'ferry-dock', name: 'The Ferry Dock', roomArtId: 'room-dock', sealed: false, description: 'Pilings, rope, grey water.' },
    { id: 'salt-garden', name: 'The Salt Garden', roomArtId: 'room-garden', sealed: false, description: 'Evaporation pans, white crust.' },
    { id: 'undervault', name: 'The Undervault', roomArtId: 'room-vault', sealed: true, description: 'Below the office. Low tide only. No door a person fits.' },
    { id: 'tavern', name: 'The Low Lamp', roomArtId: 'room-tavern', sealed: false, description: 'A tavern that keeps its lamp low.' },
    { id: 'bellfoundry', name: 'The Old Foundry', roomArtId: 'room-foundry', sealed: false, description: 'Cold since Year 41. The mould is still here.' },
  ],
  hosts: [
    { id: 'merra', name: 'Merra Quill', species: 'human', birthYear: 28, deathYear: 78, role: 'Tallyman, First Assize of Saltmere', homeLocation: 'assize-office', portraitId: 'face-merra', seed: 'Counts honestly in a town that would rather she did not.', watched: false },
    { id: 'dovan', name: 'Dovan Reed', species: 'human', birthYear: 40, deathYear: 90, role: 'Ferryman', homeLocation: 'ferry-dock', portraitId: 'face-dovan', seed: 'Knows what the lake takes and never says.', watched: false },
    { id: 'issa', name: 'Issa Brine', species: 'human', birthYear: 45, deathYear: 95, role: 'Salt-gardener', homeLocation: 'salt-garden', portraitId: 'face-issa', seed: 'Her pans fail in a pattern she has started to chart.', watched: false },
    { id: 'corb', name: 'Corb Halloway', species: 'human', birthYear: 22, deathYear: 72, role: 'Retired Assize courier', homeLocation: 'tavern', portraitId: 'face-corb', seed: 'Carried folios for forty years. Remembers a year he was never paid for.', watched: false },
    { id: 'raven-1', name: 'A ledger-raven', species: 'raven', birthYear: 55, deathYear: 95, role: 'Assize raven', homeLocation: 'assize-office', portraitId: 'face-raven', seed: 'Wears a numbered band. Nobody remembers banding it.', watched: false },
    { id: 'rat-1', name: 'A dock rat', species: 'rat', birthYear: 63, deathYear: 66, role: 'Rat', homeLocation: 'undervault', portraitId: 'face-rat', seed: 'Small enough for the spaces the Assize forgot to seal.', watched: false },
  ],
  sealedTruths: [
    {
      text: 'The salt-garden fails because Halden Vosse ordered its brine feed narrowed in Year 58, to mask a shortfall in his tallies.',
      knownTo: ['Dovan Reed'],
    },
    {
      text: 'Corb Halloway once carried a folio whose sums the Warden rewrote; the original lies wrapped in oilcloth under the ninth evaporation pan.',
      knownTo: ['Corb Halloway'],
    },
  ],
  primePoetic: 'The Warden of Saltmere cannot fall while his count is believed. Bring the town three things and he is done.',
  primeConditions: [
    {
      id: 'prime-1', kind: 'prime',
      poetic: 'A folio read aloud on the dock at noon.',
      hiddenCondition: 'Fulfilled when: a genuine Assize folio from the undervault is read aloud, publicly, at the ferry dock, by any host or person, witnessed by at least one Saltmere resident.',
      roles: [{ label: 'the reader', boundTo: null, penciled: false }],
      tags: ['folio', 'reading', 'dock', 'public'],
      sealedSketch: '', state: 'unaimed', contacts: 0, aimDeclaration: null,
    },
    {
      id: 'prime-2', kind: 'prime',
      poetic: 'The garden made to bloom in salt.',
      hiddenCondition: 'Fulfilled when: the cause of the salt-garden failure is established on the record and physically corrected, and the pans yield again.',
      roles: [{ label: 'the mender', boundTo: null, penciled: false }],
      tags: ['salt-garden', 'pans', 'repair', 'yield'],
      sealedSketch: '', state: 'unaimed', contacts: 0, aimDeclaration: null,
    },
    {
      id: 'prime-3', kind: 'prime',
      poetic: 'The Warden’s own mark on a page he never wrote.',
      hiddenCondition: 'Fulfilled when: the Warden of Saltmere signs or seals a document whose contents were authored by a player host, without coercion by force.',
      roles: [{ label: 'the forged page', boundTo: null, penciled: false }],
      tags: ['warden', 'signature', 'seal', 'document'],
      sealedSketch: '', state: 'unaimed', contacts: 0, aimDeclaration: null,
    },
  ],
  looseProphecies: [
    {
      id: 'loose-1', kind: 'loose',
      poetic: 'A ferryman will carry the same passenger twice.',
      hiddenCondition: 'Fulfilled when: the bound ferryman knowingly carries the bound passenger across the Grey Lake on two separate crossings.',
      roles: [
        { label: 'the ferryman', boundTo: null, penciled: false },
        { label: 'the passenger', boundTo: null, penciled: false },
      ],
      tags: ['ferry', 'crossing', 'lake', 'passenger'],
      sealedSketch: 'If neglected: the lake claims a crossing. The second carrying is a body, and the ferryman stops counting passengers at all.',
      state: 'unaimed', contacts: 0, aimDeclaration: null,
    },
    {
      id: 'loose-2', kind: 'loose',
      poetic: 'Salt will keep what ink could not.',
      hiddenCondition: 'Fulfilled when: a written record destroyed or falsified in ink is proven true again by evidence preserved in salt (a pan, a crust, the garden).',
      roles: [{ label: 'the record', boundTo: null, penciled: false }],
      tags: ['salt', 'ink', 'record', 'preservation'],
      sealedSketch: 'If neglected: something better left dissolved is preserved instead — the Warden’s error, cured hard as stone, and blamed on the gardener.',
      state: 'unaimed', contacts: 0, aimDeclaration: null,
    },
    {
      id: 'loose-3', kind: 'loose',
      poetic: 'A bird will out-remember the Assize.',
      hiddenCondition: 'Fulfilled when: information lost to or removed from the Assize record is recovered by way of the bound bird (its band, its habits, its hoard, or its flight).',
      roles: [{ label: 'the bird', boundTo: null, penciled: false }],
      tags: ['raven', 'bird', 'memory', 'band'],
      sealedSketch: 'If neglected: the bird’s hoard is found by an Assize clerk instead, and what it kept convicts an innocent.',
      state: 'unaimed', contacts: 0, aimDeclaration: null,
    },
  ],
};
