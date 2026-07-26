// ============================================================
// The art shelf — placeholder pixel art, drawn in code.
// A closed set: 8 rooms, 12 human silhouettes, a raven, a rat.
// Deliberately blocky and coherent; every piece is replaceable
// by real sprites later without touching game code.
// ============================================================

// Anseld palette: salt, ink, lamplight, rust, grey lake.
export const PAL = {
  ink: '#131820',
  inkSoft: '#1d2530',
  wall: '#2a3340',
  wallLit: '#39465a',
  floor: '#4a4438',
  floorLit: '#5d5646',
  salt: '#cfc9b8',
  saltDim: '#a49e8d',
  lamp: '#d9a441',
  lampDim: '#8a6a2e',
  rust: '#8a4a33',
  lake: '#3e5560',
  lakeLit: '#557383',
  cloak: '#242c26',
  skin: '#b08d6a',
  paper: '#c9bfa4',
};

const W = 192;
const H = 108;

type Ctx = CanvasRenderingContext2D;

function px(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** Deterministic tiny hash → 0..n-1 */
function hashPick(seed: string, n: number): number {
  let h = 7;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % n;
}

// ---------------- Rooms ----------------

const ROOM_TINTS: Array<{ wall: string; floor: string; accent: string }> = [
  { wall: PAL.wall, floor: PAL.floor, accent: PAL.paper },   // office
  { wall: PAL.lake, floor: PAL.floor, accent: PAL.lakeLit }, // dock
  { wall: PAL.wallLit, floor: PAL.saltDim, accent: PAL.salt }, // salt garden
  { wall: PAL.inkSoft, floor: PAL.ink, accent: PAL.rust },   // vault
  { wall: '#3a2f28', floor: '#4a3b2e', accent: PAL.lamp },   // tavern
  { wall: PAL.wall, floor: '#3a3a3a', accent: PAL.rust },    // foundry
  { wall: PAL.wallLit, floor: PAL.floorLit, accent: PAL.paper }, // hall
  { wall: PAL.lake, floor: PAL.saltDim, accent: PAL.salt },  // shore
];

export function drawRoom(ctx: Ctx, roomArtId: string, sealed: boolean) {
  const idx = (parseInt(roomArtId.replace(/\D/g, ''), 10) || 1) - 1;
  const tint = ROOM_TINTS[idx % ROOM_TINTS.length];

  // Walls and floor.
  px(ctx, 0, 0, W, H, tint.wall);
  px(ctx, 0, H * 0.62, W, H * 0.38, tint.floor);
  px(ctx, 0, H * 0.62, W, 2, PAL.ink); // floor line

  // Piling shadows — everything in Anseld stands on pilings.
  for (let i = 0; i < 6; i++) {
    px(ctx, 8 + i * 32, H * 0.62 + 6, 4, H * 0.38 - 6, shade(tint.floor, -18));
  }

  // A high, mean little window with grey-lake light.
  if (!sealed) {
    px(ctx, W - 40, 10, 22, 16, PAL.ink);
    px(ctx, W - 38, 12, 18, 12, tint === ROOM_TINTS[1] ? PAL.lakeLit : '#6a7a84');
    px(ctx, W - 30, 12, 2, 12, PAL.ink);
  }

  // Room-specific props, blocky and honest.
  switch (idx % 8) {
    case 0: { // office: desk, ledger, shelf
      prop_desk(ctx, 30, H * 0.60, tint.accent);
      prop_shelf(ctx, 10, 18, tint.accent);
      break;
    }
    case 1: { // dock: pilings, rope, water band
      px(ctx, 0, H * 0.52, W, H * 0.10, PAL.lake);
      px(ctx, 0, H * 0.52, W, 2, PAL.lakeLit);
      px(ctx, 20, H * 0.40, 6, H * 0.32, '#5a4632');
      px(ctx, 150, H * 0.40, 6, H * 0.32, '#5a4632');
      px(ctx, 20, H * 0.44, 136, 3, '#7a6a4a'); // rope
      break;
    }
    case 2: { // salt garden: evaporation pans
      for (let i = 0; i < 3; i++) {
        px(ctx, 18 + i * 56, H * 0.68, 44, 14, PAL.saltDim);
        px(ctx, 20 + i * 56, H * 0.70, 40, 10, PAL.salt);
      }
      break;
    }
    case 3: { // vault: shelves in the dark, one gleam
      prop_shelf(ctx, 20, 24, PAL.rust);
      prop_shelf(ctx, 80, 24, PAL.rust);
      prop_shelf(ctx, 140, 24, PAL.rust);
      px(ctx, 96, 40, 3, 3, PAL.lamp);
      break;
    }
    case 4: { // tavern: low lamp, barrels
      px(ctx, 90, 14, 10, 8, PAL.lampDim);
      px(ctx, 93, 22, 4, 6, PAL.lamp);
      prop_barrel(ctx, 24, H * 0.66);
      prop_barrel(ctx, 44, H * 0.66);
      prop_desk(ctx, 120, H * 0.60, '#5a4632');
      break;
    }
    case 5: { // foundry: the cold mould under a tarp
      px(ctx, 60, H * 0.48, 60, 30, '#4a4a52');
      px(ctx, 56, H * 0.46, 68, 8, '#6a6a72'); // tarp fold
      px(ctx, 30, H * 0.70, 16, 10, PAL.rust);
      break;
    }
    case 6: { // hall: long table, tally marks on the wall
      px(ctx, 40, H * 0.58, 110, 8, '#5a4632');
      for (let i = 0; i < 12; i++) px(ctx, 24 + i * 12, 26, 2, 10, tint.accent);
      break;
    }
    case 7: { // shore: salt crust and one boat rib
      px(ctx, 0, H * 0.52, W, H * 0.10, PAL.lake);
      px(ctx, 60, H * 0.70, 70, 4, PAL.salt);
      px(ctx, 90, H * 0.56, 4, 18, '#5a4632');
      break;
    }
  }

  if (sealed) {
    // Sealed rooms are dark; a thin crack of light at floor level.
    ctx.fillStyle = 'rgba(8,10,14,0.55)';
    ctx.fillRect(0, 0, W, H);
    px(ctx, 84, H * 0.62 - 1, 30, 2, PAL.lampDim);
  }

  // Vignette — lamplight economy.
  const g = ctx.createRadialGradient(W / 2, H * 0.55, 20, W / 2, H * 0.55, 120);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(5,8,12,0.5)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function prop_desk(ctx: Ctx, x: number, y: number, paper: string) {
  px(ctx, x, y, 40, 5, '#5a4632');
  px(ctx, x + 3, y + 5, 4, 12, '#4a3826');
  px(ctx, x + 33, y + 5, 4, 12, '#4a3826');
  px(ctx, x + 6, y - 4, 12, 4, paper); // an open folio
  px(ctx, x + 24, y - 3, 8, 3, paper);
}

function prop_shelf(ctx: Ctx, x: number, y: number, accent: string) {
  px(ctx, x, y, 34, 40, PAL.inkSoft);
  for (let r = 0; r < 3; r++) {
    px(ctx, x + 2, y + 4 + r * 12, 30, 2, '#4a3826');
    for (let b = 0; b < 5; b++) {
      px(ctx, x + 3 + b * 6, y + 6 + r * 12, 4, 8, b % 2 ? accent : PAL.saltDim);
    }
  }
}

function prop_barrel(ctx: Ctx, x: number, y: number) {
  px(ctx, x, y, 14, 18, '#5a4632');
  px(ctx, x, y + 4, 14, 2, PAL.ink);
  px(ctx, x, y + 12, 14, 2, PAL.ink);
}

function shade(hex: string, delta: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + delta));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + delta));
  const b = Math.max(0, Math.min(255, (n & 255) + delta));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// ---------------- Figures ----------------

const CLOAKS = ['#242c26', '#2c2431', '#312820', '#20282e', '#2e2222', '#26262e'];
const TRIMS = [PAL.paper, PAL.lamp, PAL.saltDim, PAL.lakeLit, PAL.rust, PAL.salt];

/** A host figure, ~18x34, standing. Silhouette-with-a-face-hint. */
export function drawFigure(ctx: Ctx, portraitId: string, x: number, y: number, watched: boolean) {
  if (portraitId === 'face-raven') return drawRaven(ctx, x, y);
  if (portraitId === 'face-rat') return drawRat(ctx, x, y);

  const v = hashPick(portraitId, 6);
  const hooded = hashPick(portraitId + 'h', 3) === 0;
  const cloak = CLOAKS[v];
  const trim = TRIMS[hashPick(portraitId + 't', 6)];

  // body
  px(ctx, x + 3, y + 12, 12, 20, cloak);
  px(ctx, x + 3, y + 12, 12, 2, shade(cloak, 14));
  px(ctx, x + 8, y + 14, 2, 16, trim); // clasp line
  // head
  if (hooded) {
    px(ctx, x + 4, y + 2, 10, 10, cloak);
    px(ctx, x + 6, y + 5, 6, 5, PAL.ink);
  } else {
    px(ctx, x + 5, y + 3, 8, 9, PAL.skin);
    px(ctx, x + 4, y + 1, 10, 4, hashPick(portraitId + 'r', 2) ? cloak : '#3a3a3a'); // hair/cap
    px(ctx, x + 7, y + 7, 1, 1, PAL.ink);
    px(ctx, x + 10, y + 7, 1, 1, PAL.ink);
  }
  // feet
  px(ctx, x + 4, y + 32, 4, 2, PAL.ink);
  px(ctx, x + 10, y + 32, 4, 2, PAL.ink);

  if (watched) {
    // The Assize's mark: a faint tally over the head.
    px(ctx, x + 6, y - 4, 1, 3, PAL.rust);
    px(ctx, x + 9, y - 4, 1, 3, PAL.rust);
    px(ctx, x + 12, y - 4, 1, 3, PAL.rust);
  }
}

function drawRaven(ctx: Ctx, x: number, y: number) {
  px(ctx, x + 4, y + 22, 12, 7, PAL.ink);       // body
  px(ctx, x + 13, y + 18, 6, 5, PAL.ink);       // head
  px(ctx, x + 18, y + 20, 4, 2, PAL.lampDim);   // beak
  px(ctx, x + 2, y + 24, 4, 3, PAL.ink);        // tail
  px(ctx, x + 15, y + 19, 1, 1, PAL.lamp);      // eye
  px(ctx, x + 8, y + 29, 1, 4, PAL.lampDim);    // legs
  px(ctx, x + 12, y + 29, 1, 4, PAL.lampDim);
  px(ctx, x + 10, y + 23, 3, 1, PAL.rust);      // the numbered band
}

function drawRat(ctx: Ctx, x: number, y: number) {
  px(ctx, x + 4, y + 27, 11, 5, '#5a5248');
  px(ctx, x + 13, y + 26, 5, 4, '#5a5248');
  px(ctx, x + 17, y + 27, 2, 1, PAL.skin);      // nose
  px(ctx, x + 14, y + 25, 2, 2, '#5a5248');     // ear
  px(ctx, x, y + 30, 5, 1, PAL.skin);           // tail
  px(ctx, x + 15, y + 27, 1, 1, PAL.ink);       // eye
}

/** Portrait tile for lists: 24x24 head-and-shoulders. */
export function drawPortrait(ctx: Ctx, portraitId: string) {
  px(ctx, 0, 0, 24, 24, PAL.inkSoft);
  if (portraitId === 'face-raven') {
    drawRaven(ctx, 2, -8);
    return;
  }
  if (portraitId === 'face-rat') {
    drawRat(ctx, 2, -8);
    return;
  }
  const v = hashPick(portraitId, 6);
  const hooded = hashPick(portraitId + 'h', 3) === 0;
  const cloak = CLOAKS[v];
  px(ctx, 3, 16, 18, 8, cloak); // shoulders
  if (hooded) {
    px(ctx, 6, 3, 12, 13, cloak);
    px(ctx, 8, 7, 8, 6, PAL.ink);
  } else {
    px(ctx, 7, 4, 10, 12, PAL.skin);
    px(ctx, 6, 2, 12, 4, hashPick(portraitId + 'r', 2) ? cloak : '#3a3a3a');
    px(ctx, 10, 9, 1, 2, PAL.ink);
    px(ctx, 14, 9, 1, 2, PAL.ink);
  }
}

// ---------------- Scene ----------------

export const SCENE_W = W;
export const SCENE_H = H;

export function renderScene(
  canvas: HTMLCanvasElement,
  opts: { roomArtId: string; sealed: boolean; portraitId: string; watched: boolean; hostName: string; dead?: boolean },
) {
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, W, H);
  drawRoom(ctx, opts.roomArtId, opts.sealed);
  drawFigure(ctx, opts.portraitId, W / 2 - 9, H - 44, opts.watched);
  if (opts.dead) {
    ctx.fillStyle = 'rgba(10,12,16,0.6)';
    ctx.fillRect(0, 0, W, H);
  }
}
