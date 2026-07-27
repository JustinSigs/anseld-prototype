// ============================================================
// The town of Saltmere as a walkable grid. Built by code —
// rectangles and roads — so it stays legible and testable.
// Species rules live here: flues admit rats, water admits
// ravens, sealed places admit no adult human. Canon, as tiles.
// ============================================================

import type { Species } from '../core/types';

export const MAP_W = 44;
export const MAP_H = 30;

export enum Tile {
  Grass = 0,
  Street,
  Water,
  Dock, // planks
  Wall,
  FloorWood,
  FloorStone,
  FloorVault,
  Door,
  Flue, // rat-sized: the spaces the Assize forgot to seal
  SaltPan,
  Tree,
  Barrel,
}

export interface NamedPlace {
  id: string;
  name: string;
  /** A reachable anchor tile used by schedules. */
  x: number;
  y: number;
}

const grid: Tile[] = new Array(MAP_W * MAP_H).fill(Tile.Grass);

function set(x: number, y: number, t: Tile) {
  if (x >= 0 && x < MAP_W && y >= 0 && y < MAP_H) grid[y * MAP_W + x] = t;
}

function rect(x0: number, y0: number, x1: number, y1: number, t: Tile) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, t);
}

/** Walled building with a floor and one door on the bottom wall. */
function building(x0: number, y0: number, x1: number, y1: number, floor: Tile, doorX: number) {
  rect(x0, y0, x1, y1, Tile.Wall);
  rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, floor);
  set(doorX, y1, Tile.Door);
}

// --- The lake and the dock ---
rect(0, 25, MAP_W - 1, MAP_H - 1, Tile.Water); // the Grey Lake
rect(0, 21, 13, 24, Tile.Water); // the bay
rect(5, 20, 7, 26, Tile.Dock); // the pier

// --- Streets ---
rect(2, 7, 42, 7, Tile.Street); // high street
rect(2, 15, 42, 15, Tile.Street); // low street
rect(9, 7, 9, 15, Tile.Street);
rect(25, 7, 25, 15, Tile.Street);
rect(36, 7, 36, 17, Tile.Street);
rect(6, 15, 6, 19, Tile.Street); // down to the dock
set(6, 20, Tile.Dock);

// --- Buildings ---
building(5, 2, 13, 6, Tile.FloorStone, 9); // the Assize office
building(21, 2, 29, 6, Tile.FloorWood, 25); // the Low Lamp (tavern)
building(33, 2, 41, 6, Tile.FloorWood, 37); // the old foundry
building(17, 11, 22, 14, Tile.FloorWood, 19); // house row west
building(27, 11, 32, 14, Tile.FloorWood, 29); // house row east

// --- The undervault: no door. Only the flue. ---
rect(5, 9, 10, 12, Tile.Wall);
rect(6, 10, 9, 11, Tile.FloorVault);
set(10, 10, Tile.Flue); // the crack in the wall
set(11, 10, Tile.Flue); // the crawl
set(12, 10, Tile.Flue); // the mouth, at street's edge

// --- The salt garden ---
for (let py = 18; py <= 22; py += 2) {
  for (let px = 30; px <= 40; px += 3) {
    rect(px, py, px + 1, py, Tile.SaltPan);
  }
}

// --- Trees and props ---
for (const [tx, ty] of [[2, 1], [16, 1], [31, 1], [43, 3], [3, 10], [15, 12], [24, 17], [42, 12], [1, 17]] as const) {
  set(tx, ty, Tile.Tree);
}
set(20, 6, Tile.Barrel);
set(30, 6, Tile.Barrel);
set(34, 8, Tile.Barrel);

export const WORLD: readonly Tile[] = grid;

export function tileAt(x: number, y: number): Tile {
  if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) return Tile.Wall;
  return WORLD[y * MAP_W + x];
}

/** Species-aware passability — canon as collision rules. */
export function passable(species: Species, x: number, y: number): boolean {
  const t = tileAt(x, y);
  switch (t) {
    case Tile.Wall:
    case Tile.Tree:
    case Tile.Barrel:
      return false;
    case Tile.Water:
      return species === 'raven'; // ravens cross the lake; nothing else does
    case Tile.Flue:
      return species === 'rat'; // the spaces the Assize forgot to seal
    case Tile.FloorVault:
      return species === 'rat'; // reachable only through the flue anyway
    default:
      return true;
  }
}

export const PLACES: NamedPlace[] = [
  { id: 'assize', name: 'The Assize Office', x: 9, y: 4 },
  { id: 'assize-door', name: 'Assize steps', x: 9, y: 7 },
  { id: 'tavern', name: 'The Low Lamp', x: 25, y: 4 },
  { id: 'foundry', name: 'The Old Foundry', x: 37, y: 4 },
  { id: 'house-west', name: 'West house', x: 19, y: 12 },
  { id: 'house-east', name: 'East house', x: 29, y: 12 },
  { id: 'dock-end', name: 'Pier end', x: 6, y: 26 },
  { id: 'dock-base', name: 'Dock', x: 6, y: 20 },
  { id: 'pans-west', name: 'Salt pans (west)', x: 31, y: 19 },
  { id: 'pans-east', name: 'Salt pans (east)', x: 39, y: 21 },
  { id: 'flue-mouth', name: 'The flue mouth', x: 13, y: 10 },
  { id: 'vault', name: 'The undervault', x: 7, y: 10 },
  { id: 'street-mid', name: 'High street', x: 20, y: 7 },
];

export function placeById(id: string): NamedPlace {
  const p = PLACES.find((x) => x.id === id);
  if (!p) throw new Error(`No such place: ${id}`);
  return p;
}

/** BFS path for a species. Returns tile steps excluding start, or null. */
export function findPath(species: Species, sx: number, sy: number, tx: number, ty: number): Array<{ x: number; y: number }> | null {
  if (sx === tx && sy === ty) return [];
  const key = (x: number, y: number) => y * MAP_W + x;
  const prev = new Map<number, number>();
  const queue: number[] = [key(sx, sy)];
  prev.set(key(sx, sy), -1);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const cx = cur % MAP_W;
    const cy = Math.floor(cur / MAP_W);
    for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || nx >= MAP_W || ny < 0 || ny >= MAP_H) continue;
      const nk = key(nx, ny);
      if (prev.has(nk)) continue;
      if (!passable(species, nx, ny)) continue;
      prev.set(nk, cur);
      if (nx === tx && ny === ty) {
        const path: Array<{ x: number; y: number }> = [];
        let node = nk;
        while (node !== key(sx, sy)) {
          path.unshift({ x: node % MAP_W, y: Math.floor(node / MAP_W) });
          node = prev.get(node)!;
        }
        return path;
      }
      queue.push(nk);
    }
  }
  return null;
}
