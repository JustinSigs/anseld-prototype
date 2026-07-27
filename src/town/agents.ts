// ============================================================
// The cast and their clockwork: everyone in Saltmere has a day.
// Schedules are plain data — hour → place → activity — and the
// sim walks people between them. No AI anywhere in here.
// ============================================================

import type { Species } from '../core/types';
import { placeById } from './world';

export interface ScheduleStop {
  /** Hour of day this stop begins (fractional allowed). */
  at: number;
  placeId: string;
  activity: string;
}

export interface AgentDef {
  id: string;
  name: string;
  species: Species;
  role: string;
  /** One line the mock dialogue and live prompts both build on. */
  seed: string;
  schedule: ScheduleStop[];
  /** Sprite composition indices (body row, clothes column) for the char sheet. */
  look: { body: number; outfit: number };
}

export const AGENTS: AgentDef[] = [
  {
    id: 'merra', name: 'Merra Quill', species: 'human', role: 'Tallyman, First Assize',
    seed: 'Counts honestly in a town that would rather she did not.',
    look: { body: 0, outfit: 0 },
    schedule: [
      { at: 6, placeId: 'assize', activity: 'counting' },
      { at: 12, placeId: 'tavern', activity: 'eating' },
      { at: 13, placeId: 'assize', activity: 'counting' },
      { at: 20, placeId: 'house-west', activity: 'home' },
    ],
  },
  {
    id: 'dovan', name: 'Dovan Reed', species: 'human', role: 'Ferryman',
    seed: 'Knows what the lake takes and never says.',
    look: { body: 1, outfit: 1 },
    schedule: [
      { at: 5, placeId: 'dock-end', activity: 'crossing' },
      { at: 11, placeId: 'dock-base', activity: 'mending nets' },
      { at: 12.5, placeId: 'tavern', activity: 'eating' },
      { at: 14, placeId: 'dock-end', activity: 'crossing' },
      { at: 21, placeId: 'house-east', activity: 'home' },
    ],
  },
  {
    id: 'issa', name: 'Issa Brine', species: 'human', role: 'Salt-gardener',
    seed: 'Her pans fail in a pattern she has started to chart.',
    look: { body: 2, outfit: 2 },
    schedule: [
      { at: 6, placeId: 'pans-west', activity: 'raking salt' },
      { at: 12, placeId: 'pans-east', activity: 'charting the pans' },
      { at: 19, placeId: 'house-west', activity: 'home' },
    ],
  },
  {
    id: 'corb', name: 'Corb Halloway', species: 'human', role: 'Retired Assize courier',
    seed: 'Carried folios for forty years. Remembers a year he was never paid for.',
    look: { body: 3, outfit: 3 },
    schedule: [
      { at: 9, placeId: 'foundry', activity: 'tinkering' },
      { at: 12, placeId: 'tavern', activity: 'drinking' },
      { at: 17, placeId: 'street-mid', activity: 'walking the street' },
      { at: 19, placeId: 'tavern', activity: 'drinking' },
      { at: 23, placeId: 'house-east', activity: 'home' },
    ],
  },
  {
    id: 'bel', name: 'Bel Tarrow', species: 'human', role: 'Keeper of the Low Lamp',
    seed: 'Keeps the lamp low and the questions lower.',
    look: { body: 4, outfit: 4 },
    schedule: [{ at: 4, placeId: 'tavern', activity: 'keeping the lamp' }],
  },
  {
    id: 'wren', name: 'Wren Tallow', species: 'human', role: 'Salt-pan child',
    seed: 'Plays at the flue mouth and hears something down there breathing.',
    look: { body: 5, outfit: 5 },
    schedule: [
      { at: 7, placeId: 'pans-west', activity: 'playing' },
      { at: 10, placeId: 'flue-mouth', activity: 'listening at the flue' },
      { at: 14, placeId: 'dock-base', activity: 'skipping stones' },
      { at: 19, placeId: 'house-west', activity: 'home' },
    ],
  },
  {
    id: 'raven-1', name: 'A ledger-raven', species: 'raven', role: 'Assize raven',
    seed: 'Wears a numbered band. Nobody remembers banding it.',
    look: { body: 0, outfit: 0 },
    schedule: [
      { at: 6, placeId: 'assize-door', activity: 'watching' },
      { at: 10, placeId: 'pans-east', activity: 'stealing salt' },
      { at: 16, placeId: 'dock-end', activity: 'watching the water' },
      { at: 22, placeId: 'assize-door', activity: 'roosting' },
    ],
  },
  {
    id: 'rat-1', name: 'A dock rat', species: 'rat', role: 'Rat',
    seed: 'Small enough for the spaces the Assize forgot to seal.',
    look: { body: 0, outfit: 0 },
    schedule: [
      { at: 3, placeId: 'vault', activity: 'gnawing' },
      { at: 13, placeId: 'dock-base', activity: 'foraging' },
      { at: 22, placeId: 'vault', activity: 'gnawing' },
    ],
  },
];

/** The stop an agent should be honoring at a given hour of day. */
export function currentStop(def: AgentDef, hourF: number): ScheduleStop {
  const sorted = [...def.schedule].sort((a, b) => a.at - b.at);
  let active = sorted[sorted.length - 1]; // overnight carry-over
  for (const stop of sorted) {
    if (hourF >= stop.at) active = stop;
  }
  return active;
}

export function stopTarget(stop: ScheduleStop): { x: number; y: number } {
  const p = placeById(stop.placeId);
  return { x: p.x, y: p.y };
}
