// Save/load: the whole run is the Record + the era sheet + the dials.

import { GameRecord } from '../core/record';
import type { Dials, EraSheet } from '../core/types';

const KEY = 'anseld.save.v1';

export interface SaveData {
  mode: 'mock' | 'live';
  sheet: EraSheet;
  dials: Dials;
  recordJson: string;
  ui: { locationId: string; lastChoices: string[]; recentProse: string[]; lastProse: string };
}

export function saveRun(data: SaveData): void {
  localStorage.setItem(KEY, JSON.stringify(data));
}

export function loadRun(): (Omit<SaveData, 'recordJson'> & { record: GameRecord }) | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    const data: SaveData = JSON.parse(raw);
    return { ...data, record: GameRecord.deserialize(data.recordJson) };
  } catch {
    return null;
  }
}

export function clearRun(): void {
  localStorage.removeItem(KEY);
}

export function exportRun(): string | null {
  return localStorage.getItem(KEY);
}
