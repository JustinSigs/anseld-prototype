// ============================================================
// Canvas renderer for the clockwork town.
// Terrain is drawn flat from the Anseld palette (we control the
// mood); Kenney's CC0 roguelike sheets supply the living things —
// characters, trees, props. If a sheet fails to load, blocky
// fallbacks render instead: the game never white-screens over art.
// ============================================================

import { MAP_H, MAP_W, Tile, tileAt } from './world';
import type { TownSim, AgentState } from './sim';

export const TILE = 16;
export const SCALE = 3;
export const CELL = TILE * SCALE;
export const VIEW_W = 20; // cells
export const VIEW_H = 13;

/** Kenney sheets: 16px tiles, 1px margin → 17px stride. */
const STRIDE = 17;

const TERRAIN_COLORS: Record<Tile, string> = {
  [Tile.Grass]: '#4e5d3a',
  [Tile.Street]: '#6b5f4b',
  [Tile.Water]: '#3e5560',
  [Tile.Dock]: '#7a6248',
  [Tile.Wall]: '#2a3340',
  [Tile.FloorWood]: '#5d4a36',
  [Tile.FloorStone]: '#565d66',
  [Tile.FloorVault]: '#1d2530',
  [Tile.Door]: '#3f3227',
  [Tile.Flue]: '#161c26',
  [Tile.SaltPan]: '#cfc9b8',
  [Tile.Tree]: '#4e5d3a',
  [Tile.Barrel]: '#6b5f4b',
};

/** Sprite picks from roguelikeSheet_transparent.png as [col, row]. Tuned by eye. */
const SHEET_SPRITES: Partial<Record<Tile, [number, number]>> = {
  [Tile.Tree]: [13, 9],
  [Tile.Barrel]: [40, 15],
};

export class TownRenderer {
  private sheet: HTMLImageElement | null = null;
  private chars: HTMLImageElement | null = null;
  camX = 0;
  camY = 0;

  constructor(private canvas: HTMLCanvasElement) {
    canvas.width = VIEW_W * CELL;
    canvas.height = VIEW_H * CELL;
    this.loadImage('town-assets/roguelikeSheet_transparent.png').then((img) => (this.sheet = img));
    this.loadImage('town-assets/roguelikeChar_transparent.png').then((img) => (this.chars = img));
  }

  private loadImage(src: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  render(sim: TownSim): void {
    const ctx = this.canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    // Camera follows the worn body, clamped to the map.
    const p = sim.player();
    this.camX = Math.max(0, Math.min(MAP_W - VIEW_W, p.x - Math.floor(VIEW_W / 2)));
    this.camY = Math.max(0, Math.min(MAP_H - VIEW_H, p.y - Math.floor(VIEW_H / 2)));

    // Terrain.
    for (let vy = 0; vy < VIEW_H; vy++) {
      for (let vx = 0; vx < VIEW_W; vx++) {
        const x = this.camX + vx;
        const y = this.camY + vy;
        const t = tileAt(x, y);
        ctx.fillStyle = TERRAIN_COLORS[t];
        ctx.fillRect(vx * CELL, vy * CELL, CELL, CELL);
        this.decorate(ctx, t, x, y, vx, vy);
        const sprite = SHEET_SPRITES[t];
        if (sprite && this.sheet) {
          ctx.drawImage(this.sheet, sprite[0] * STRIDE, sprite[1] * STRIDE, TILE, TILE, vx * CELL, vy * CELL, CELL, CELL);
        }
      }
    }

    // Agents, back-to-front by y.
    const sorted = [...sim.agents].sort((a, b) => a.y - b.y);
    for (const agent of sorted) {
      const vx = agent.x - this.camX;
      const vy = agent.y - this.camY;
      if (vx < 0 || vx >= VIEW_W || vy < 0 || vy >= VIEW_H) continue;
      this.drawAgent(ctx, agent, vx, vy);
    }

    // Day/night tint.
    const darkness = sim.clock.darkness;
    if (darkness > 0) {
      ctx.fillStyle = `rgba(10, 16, 32, ${darkness * 0.55})`;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  /** Cheap hand-drawn texture so flat terrain doesn't read as flat. */
  private decorate(ctx: CanvasRenderingContext2D, t: Tile, x: number, y: number, vx: number, vy: number): void {
    const px = vx * CELL;
    const py = vy * CELL;
    const h = ((x * 31 + y * 17) % 7) as number; // stable per-tile variation
    switch (t) {
      case Tile.Water: {
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        if (h < 2) ctx.fillRect(px + 8, py + 20 + h * 6, 18, 3);
        break;
      }
      case Tile.Grass: {
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        if (h < 3) ctx.fillRect(px + 6 + h * 12, py + 10 + h * 8, 4, 4);
        break;
      }
      case Tile.Street: {
        ctx.fillStyle = 'rgba(0,0,0,0.10)';
        if (h < 2) ctx.fillRect(px + 10 + h * 14, py + 16, 6, 4);
        break;
      }
      case Tile.Dock: {
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        ctx.fillRect(px, py + CELL - 4, CELL, 2);
        break;
      }
      case Tile.Wall: {
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.fillRect(px, py, CELL, 5);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(px, py + CELL - 5, CELL, 5);
        break;
      }
      case Tile.Door: {
        ctx.fillStyle = '#241b12';
        ctx.fillRect(px + 8, py + 6, CELL - 16, CELL - 6);
        ctx.fillStyle = '#d9a441';
        ctx.fillRect(px + CELL - 16, py + CELL / 2, 4, 4);
        break;
      }
      case Tile.SaltPan: {
        ctx.fillStyle = 'rgba(62,85,96,0.35)';
        ctx.fillRect(px + 4, py + 4, CELL - 8, CELL - 8);
        break;
      }
      case Tile.Flue: {
        ctx.fillStyle = 'rgba(217,164,65,0.20)';
        ctx.fillRect(px + 14, py + 20, 20, 8);
        break;
      }
      case Tile.FloorWood:
      case Tile.FloorStone: {
        ctx.fillStyle = 'rgba(0,0,0,0.10)';
        ctx.fillRect(px, py + CELL - 2, CELL, 1);
        break;
      }
    }
  }

  private drawAgent(ctx: CanvasRenderingContext2D, agent: AgentState, vx: number, vy: number): void {
    const px = vx * CELL;
    const py = vy * CELL;

    if (agent.def.species === 'raven') {
      this.blob(ctx, px, py, '#131820', '#d9a441');
      return;
    }
    if (agent.def.species === 'rat') {
      this.blob(ctx, px + 6, py + 10, '#5a5248', '#b08d6a');
      return;
    }

    if (this.chars) {
      // Kenney char sheet: column 0 holds base bodies, one per row;
      // an outfit overlay comes from the shirt block further right.
      ctx.drawImage(this.chars, 0, (agent.def.look.body % 8) * STRIDE, TILE, TILE, px, py, CELL, CELL);
      ctx.drawImage(this.chars, (6 + (agent.def.look.outfit % 6)) * STRIDE, 0, TILE, TILE, px, py, CELL, CELL);
    } else {
      ctx.fillStyle = '#b08d6a';
      ctx.fillRect(px + 14, py + 6, 20, 14);
      ctx.fillStyle = '#2c3440';
      ctx.fillRect(px + 12, py + 20, 24, 22);
    }

    if (agent.worn) {
      ctx.strokeStyle = '#d9a441';
      ctx.lineWidth = 2;
      ctx.strokeRect(px + 2, py + 2, CELL - 4, CELL - 4);
    }
  }

  private blob(ctx: CanvasRenderingContext2D, px: number, py: number, body: string, eye: string): void {
    ctx.fillStyle = body;
    ctx.fillRect(px + 12, py + 24, 22, 12);
    ctx.fillRect(px + 30, py + 18, 10, 10);
    ctx.fillStyle = eye;
    ctx.fillRect(px + 34, py + 21, 3, 3);
  }

  /** Screen position of a tile (for HUD overlays like nameplates). */
  screenPos(x: number, y: number): { sx: number; sy: number; visible: boolean } {
    const vx = x - this.camX;
    const vy = y - this.camY;
    return { sx: vx * CELL, sy: vy * CELL, visible: vx >= 0 && vx < VIEW_W && vy >= 0 && vy < VIEW_H };
  }
}
