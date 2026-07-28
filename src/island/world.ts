// ============================================================
// Gullshead Island — a tourist destination, allegedly.
// Reached by ferry from the mainland. Four ruins with potential,
// one lighthouse, one chapel that doesn't like being looked at,
// and a mayor (you) with a treasury the size of a chowder bowl.
// ============================================================

export const MAP_W = 48;
export const MAP_H = 34;

export enum Tile {
  Grass = 0,
  Sand,
  Plaza,
  Street,
  Water,
  Pier,
  Wall,
  Floor,
  Door, // carries a building id via DOORS
  Tree,
  Bench,
  RuinRubble,
}

export type WantKind = 'food' | 'fun' | 'history' | 'rest';

export interface Lot {
  id: string;
  name: string;
  ruinedName: string;
  want: WantKind;
  cost: number;
  x0: number; y0: number; x1: number; y1: number;
  doorX: number; doorY: number;
  /** Where visitors stand inside. */
  anchorX: number; anchorY: number;
  blurb: string; // notice-board copy, municipal deadpan
}

export const LOTS: Lot[] = [
  {
    id: 'inn', name: 'The Gullshead Inn', ruinedName: 'the boarded-up inn', want: 'rest', cost: 30,
    x0: 8, y0: 9, x1: 15, y1: 14, doorX: 11, doorY: 14, anchorX: 11, anchorY: 11,
    blurb: 'Twelve beds, one alleged draft. Tourists who sleep indoors complain less and see less.',
  },
  {
    id: 'chowder', name: 'The Chowder House', ruinedName: 'the burnt chowder house', want: 'food', cost: 25,
    x0: 30, y0: 8, x1: 36, y1: 12, doorX: 33, doorY: 12, anchorX: 33, anchorY: 10,
    blurb: 'Fire damage cosmetic. Chowder recipe survived. Priorities intact.',
  },
  {
    id: 'bandstand', name: 'The Bandstand', ruinedName: 'the collapsed bandstand', want: 'fun', cost: 20,
    x0: 4, y0: 20, x1: 9, y1: 24, doorX: 7, doorY: 24, anchorX: 6, anchorY: 22,
    blurb: 'Music nightly, weather and morale permitting. Structurally optimistic.',
  },
  {
    id: 'museum', name: 'The Island Museum', ruinedName: 'the shuttered museum', want: 'history', cost: 25,
    x0: 38, y0: 16, x1: 44, y1: 20, doorX: 41, doorY: 20, anchorX: 41, anchorY: 18,
    blurb: 'Local history, tastefully curated. Some exhibits omitted for everyone’s comfort.',
  },
];

export interface NamedPlace {
  id: string;
  name: string;
  x: number;
  y: number;
}

const grid: Tile[] = new Array(MAP_W * MAP_H).fill(Tile.Grass);
/** door tile → building id ('inn', 'office', 'lighthouse'…) */
export const DOORS = new Map<number, string>();

const key = (x: number, y: number) => y * MAP_W + x;

function set(x: number, y: number, t: Tile) {
  if (x >= 0 && x < MAP_W && y >= 0 && y < MAP_H) grid[key(x, y)] = t;
}
function rect(x0: number, y0: number, x1: number, y1: number, t: Tile) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, t);
}
function building(x0: number, y0: number, x1: number, y1: number, doorX: number, doorY: number, id: string) {
  rect(x0, y0, x1, y1, Tile.Wall);
  rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, Tile.Floor);
  set(doorX, doorY, Tile.Door);
  DOORS.set(key(doorX, doorY), id);
}

// --- The sea, the beach, the pier ---
rect(0, 28, MAP_W - 1, MAP_H - 1, Tile.Water);
rect(0, 25, 17, 27, Tile.Sand); // the beach
rect(18, 25, MAP_W - 1, 27, Tile.Grass);
rect(23, 26, 24, 32, Tile.Pier); // the ferry pier

// --- Streets, square, lanes ---
rect(6, 15, 44, 15, Tile.Street); // main street
rect(24, 15, 24, 26, Tile.Street); // pier road
rect(20, 16, 28, 20, Tile.Plaza); // town square
rect(6, 7, 41, 7, Tile.Street); // the north lane (the Walker's route)
rect(41, 4, 41, 15, Tile.Street); // lighthouse path
rect(11, 7, 11, 9, Tile.Street); // lane to inn rear? (connects north lane to inn block)
rect(11, 15, 11, 14, Tile.Street);
rect(33, 12, 33, 15, Tile.Street);
rect(6, 7, 6, 15, Tile.Street); // chapel lane down to main street
rect(7, 21, 7, 24, Tile.Sand);

// --- Buildings that already work ---
building(30, 16, 35, 19, 32, 19, 'office'); // the mayor's office
building(39, 1, 43, 4, 41, 4, 'lighthouse'); // the lighthouse
// The chapel ruin: low rubble, no roof, no door — it is always open and always cold.
rect(4, 3, 8, 6, Tile.RuinRubble);

// --- The four lots (drawn as buildings; render + sim treat state) ---
for (const lot of LOTS) {
  building(lot.x0, lot.y0, lot.x1, lot.y1, lot.doorX, lot.doorY, lot.id);
}
// Bandstand is an open platform, not a walled box: knock its walls down to rubble edges.
rect(4, 20, 9, 24, Tile.RuinRubble);
rect(5, 21, 8, 23, Tile.Floor);
set(7, 24, Tile.Door);
DOORS.set(key(7, 24), 'bandstand');

// --- Furniture and nature ---
for (const [bx, by] of [[21, 18], [27, 18], [21, 20], [27, 20]] as const) set(bx, by, Tile.Bench);
for (const [tx, ty] of [[2, 9], [3, 12], [5, 10], [1, 5], [14, 3], [20, 3], [28, 3], [34, 5], [46, 8], [46, 13], [2, 18], [16, 22], [37, 22], [46, 22], [18, 10], [26, 10]] as const) {
  set(tx, ty, Tile.Tree);
}

export const WORLD: readonly Tile[] = grid;

export function tileAt(x: number, y: number): Tile {
  if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) return Tile.Wall;
  return WORLD[key(x, y)];
}

/**
 * Passability. Doors belong to buildings: lot doors open only when the lot
 * is repaired ('open'); the office and lighthouse are always open.
 */
export function passable(x: number, y: number, lotOpen: (lotId: string) => boolean): boolean {
  const t = tileAt(x, y);
  switch (t) {
    case Tile.Wall:
    case Tile.Tree:
    case Tile.Water:
      return false;
    case Tile.Door: {
      const id = DOORS.get(key(x, y))!;
      if (id === 'office' || id === 'lighthouse') return true;
      return lotOpen(id);
    }
    default:
      return true;
  }
}

export const PLACES: NamedPlace[] = [
  { id: 'pier-end', name: 'Ferry pier', x: 24, y: 31 },
  { id: 'pier-top', name: 'Top of the pier', x: 24, y: 26 },
  { id: 'square', name: 'Town square', x: 24, y: 18 },
  { id: 'notice-board', name: 'The notice board', x: 25, y: 17 },
  { id: 'office', name: 'Mayor’s office', x: 32, y: 17 },
  { id: 'beach', name: 'The beach', x: 9, y: 26 },
  { id: 'beach-water', name: 'The waterline', x: 9, y: 27 },
  { id: 'lighthouse', name: 'The lighthouse', x: 41, y: 2 },
  { id: 'lighthouse-door', name: 'Lighthouse steps', x: 41, y: 5 },
  { id: 'chapel', name: 'The chapel ruin', x: 6, y: 5 },
  { id: 'chapel-bell', name: 'The old bell', x: 5, y: 4 },
  { id: 'main-street', name: 'Main street', x: 20, y: 15 },
  { id: 'street-east', name: 'East end', x: 40, y: 15 },
  { id: 'salt-spot', name: 'The north lane', x: 20, y: 7 },
];

export function placeById(id: string): NamedPlace {
  const p = PLACES.find((x) => x.id === id);
  if (!p) throw new Error(`No such place: ${id}`);
  return p;
}

/** The Lantern Walker's route, chapel to lighthouse, along the north lane. */
export const WALKER_ROUTE: Array<{ x: number; y: number }> = [];
for (let x = 6; x <= 41; x++) WALKER_ROUTE.push({ x, y: 7 });
for (let y = 6; y >= 4; y--) WALKER_ROUTE.push({ x: 41, y });

/** Where a salt line is laid, when it is laid: across the north lane. */
export const SALT_LINE = [{ x: 20, y: 6 }, { x: 20, y: 7 }, { x: 20, y: 8 }];

/** BFS path (no species here — one mayor, many mortals). */
export function findPath(
  sx: number, sy: number, tx: number, ty: number,
  lotOpen: (lotId: string) => boolean,
): Array<{ x: number; y: number }> | null {
  if (sx === tx && sy === ty) return [];
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
      if (!passable(nx, ny, lotOpen)) continue;
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
