// ============================================================
// Drawing Gullshead: warmer palette than Anseld (it is trying
// to be a holiday destination, bless it), Kenney people, and
// the night's manifestations — glow, fog, figures in the water.
// ============================================================

import { MAP_H, MAP_W, Tile, tileAt, LOTS, SALT_LINE, DOORS } from './world';
import { eventPosition, walkerHaltsAt } from './events';
import type { IslandSim, LocalState, TouristState } from './sim';

export const TILE = 16;
export const SCALE = 3;
export const CELL = TILE * SCALE;
export const VIEW_W = 21;
export const VIEW_H = 14;
const STRIDE = 17;

const COLORS: Record<Tile, string> = {
  [Tile.Grass]: '#5a7248',
  [Tile.Sand]: '#c9b284',
  [Tile.Plaza]: '#8a8276',
  [Tile.Street]: '#7a6f58',
  [Tile.Water]: '#3a6274',
  [Tile.Pier]: '#8a6f4d',
  [Tile.Wall]: '#4a4238',
  [Tile.Floor]: '#6d5942',
  [Tile.Door]: '#3f3227',
  [Tile.Tree]: '#5a7248',
  [Tile.Bench]: '#8a8276',
  [Tile.RuinRubble]: '#6a6258',
};

export class IslandRenderer {
  private sheet: HTMLImageElement | null = null;
  private chars: HTMLImageElement | null = null;
  camX = 0;
  camY = 0;

  constructor(private canvas: HTMLCanvasElement) {
    canvas.width = VIEW_W * CELL;
    canvas.height = VIEW_H * CELL;
    this.load('town-assets/roguelikeSheet_transparent.png').then((i) => (this.sheet = i));
    this.load('town-assets/roguelikeChar_transparent.png').then((i) => (this.chars = i));
  }

  private load(src: string): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  render(sim: IslandSim): void {
    const ctx = this.canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    this.camX = Math.max(0, Math.min(MAP_W - VIEW_W, sim.mayor.x - Math.floor(VIEW_W / 2)));
    this.camY = Math.max(0, Math.min(MAP_H - VIEW_H, sim.mayor.y - Math.floor(VIEW_H / 2)));

    for (let vy = 0; vy < VIEW_H; vy++) {
      for (let vx = 0; vx < VIEW_W; vx++) {
        const x = this.camX + vx;
        const y = this.camY + vy;
        const t = tileAt(x, y);
        ctx.fillStyle = COLORS[t];
        ctx.fillRect(vx * CELL, vy * CELL, CELL, CELL);
        this.decorate(ctx, sim, t, x, y, vx * CELL, vy * CELL);
      }
    }

    // Salt line, when laid.
    if (sim.saltLineLaid) {
      for (const s of SALT_LINE) {
        const p = this.pos(s.x, s.y);
        if (!p.visible) continue;
        ctx.fillStyle = '#f2ead8';
        ctx.fillRect(p.sx + 18, p.sy, 12, CELL);
      }
    }

    // People, back to front. The mayor draws last of the living.
    const people: Array<LocalState | TouristState> = [...sim.locals, ...sim.tourists];
    people.sort((a, b) => a.y - b.y);
    for (const person of people) {
      const p = this.pos(person.x, person.y);
      if (!p.visible) continue;
      this.drawPerson(ctx, person, p.sx, p.sy);
    }
    this.drawMayor(ctx, sim);

    // Bonfire.
    if (sim.bonfireTonight && sim.clock.hourF >= 21) {
      const site = sim.bonfireTonight === 'beach' ? { x: 9, y: 26 } : { x: 24, y: 18 };
      const p = this.pos(site.x, site.y);
      if (p.visible) this.drawBonfire(ctx, p.sx, p.sy, sim.clock.totalMinutes);
    }

    // The night's manifestation.
    if (sim.eventActive && sim.tonight) {
      this.drawEvent(ctx, sim);
    }

    // Night tint (kept lighter than Anseld's — this island is trying).
    const darkness = sim.clock.darkness;
    if (darkness > 0) {
      ctx.fillStyle = `rgba(14, 20, 40, ${darkness * 0.48})`;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  private decorate(ctx: CanvasRenderingContext2D, sim: IslandSim, t: Tile, x: number, y: number, px: number, py: number): void {
    const h = (x * 31 + y * 17) % 7;
    switch (t) {
      case Tile.Water: {
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        if (h < 2) ctx.fillRect(px + 8, py + 18 + h * 8, 20, 3);
        break;
      }
      case Tile.Sand: {
        ctx.fillStyle = 'rgba(0,0,0,0.06)';
        if (h < 3) ctx.fillRect(px + 6 + h * 10, py + 12 + h * 6, 5, 3);
        break;
      }
      case Tile.Tree: {
        if (this.sheet) ctx.drawImage(this.sheet, 13 * STRIDE, 9 * STRIDE, TILE, TILE, px, py, CELL, CELL);
        else {
          ctx.fillStyle = '#3e5a34';
          ctx.fillRect(px + 8, py + 4, CELL - 16, CELL - 18);
        }
        break;
      }
      case Tile.Bench: {
        ctx.fillStyle = '#5f4a32';
        ctx.fillRect(px + 6, py + 20, CELL - 12, 8);
        ctx.fillRect(px + 8, py + 28, 4, 8);
        ctx.fillRect(px + CELL - 12, py + 28, 4, 8);
        break;
      }
      case Tile.Wall: {
        const lot = LOTS.find((l) => x >= l.x0 && x <= l.x1 && y >= l.y0 && y <= l.y1);
        const state = lot ? sim.lotStates.get(lot.id) : 'open';
        ctx.fillStyle = state === 'ruined' ? 'rgba(0,0,0,0.28)' : 'rgba(255,255,255,0.08)';
        ctx.fillRect(px, py, CELL, 5);
        if (state === 'ruined') {
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          if (h < 3) ctx.fillRect(px + 6 + h * 10, py + 8, 8, 10); // gaps in the roofline
        }
        if (state === 'building') {
          ctx.fillStyle = '#d9a441';
          ctx.fillRect(px + 4, py + 8, 6, 6); // scaffolding glints
        }
        break;
      }
      case Tile.Door: {
        const id = DOORS.get(y * MAP_W + x);
        const lot = LOTS.find((l) => l.id === id);
        const open = !lot || sim.lotStates.get(lot.id) === 'open';
        ctx.fillStyle = '#241b12';
        ctx.fillRect(px + 8, py + 6, CELL - 16, CELL - 6);
        if (!open) {
          ctx.strokeStyle = '#9a8b74';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(px + 8, py + 10);
          ctx.lineTo(px + CELL - 8, py + CELL - 6);
          ctx.moveTo(px + CELL - 8, py + 10);
          ctx.lineTo(px + 8, py + CELL - 6);
          ctx.stroke(); // boarded
        } else {
          ctx.fillStyle = '#d9a441';
          ctx.fillRect(px + CELL - 16, py + CELL / 2, 4, 4);
        }
        break;
      }
      case Tile.RuinRubble: {
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        if (h < 4) ctx.fillRect(px + 4 + h * 8, py + 10 + h * 5, 10, 8);
        break;
      }
    }
  }

  private drawPerson(ctx: CanvasRenderingContext2D, person: LocalState | TouristState, px: number, py: number): void {
    if (this.chars) {
      ctx.drawImage(this.chars, 0, (person.def.look.body % 8) * STRIDE, TILE, TILE, px, py, CELL, CELL);
      ctx.drawImage(this.chars, (6 + (person.def.look.outfit % 6)) * STRIDE, 0, TILE, TILE, px, py, CELL, CELL);
    } else {
      ctx.fillStyle = '#b08d6a';
      ctx.fillRect(px + 14, py + 6, 20, 14);
      ctx.fillStyle = '#2c3440';
      ctx.fillRect(px + 12, py + 20, 24, 22);
    }
    // Tourist mood pips.
    if ('phase' in person) {
      const t = person as TouristState;
      if (t.scared) {
        ctx.fillStyle = '#e05a3a';
        ctx.font = 'bold 20px Georgia';
        ctx.fillText('!', px + CELL - 12, py + 12);
      } else if (t.def.wants.some((w) => !t.wantsMet.includes(w)) && t.phase === 'idle') {
        ctx.fillStyle = '#c9b284';
        ctx.font = 'bold 16px Georgia';
        ctx.fillText('…', px + CELL - 18, py + 10);
      }
    }
  }

  private drawMayor(ctx: CanvasRenderingContext2D, sim: IslandSim): void {
    const p = this.pos(sim.mayor.x, sim.mayor.y);
    if (!p.visible) return;
    if (this.chars) {
      ctx.drawImage(this.chars, 0, 7 * STRIDE, TILE, TILE, p.sx, p.sy, CELL, CELL);
      ctx.drawImage(this.chars, 8 * STRIDE, 0, TILE, TILE, p.sx, p.sy, CELL, CELL);
    }
    // The mayoral sash: a band of civic responsibility.
    ctx.fillStyle = '#b03a5a';
    ctx.fillRect(p.sx + 16, p.sy + 18, 16, 4);
    ctx.strokeStyle = 'rgba(217,164,65,0.9)';
    ctx.lineWidth = 2;
    ctx.strokeRect(p.sx + 2, p.sy + 2, CELL - 4, CELL - 4);
  }

  private drawBonfire(ctx: CanvasRenderingContext2D, px: number, py: number, minutes: number): void {
    const flick = Math.sin(minutes * 1.7) * 4;
    const g = ctx.createRadialGradient(px + CELL / 2, py + CELL / 2, 4, px + CELL / 2, py + CELL / 2, 120 + flick);
    g.addColorStop(0, 'rgba(255,180,80,0.55)');
    g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(px - 120, py - 120, 288, 288);
    ctx.fillStyle = '#5f4a32';
    ctx.fillRect(px + 12, py + 26, 24, 8);
    ctx.fillStyle = '#e08a3a';
    ctx.fillRect(px + 16, py + 8 + flick / 2, 16, 20);
    ctx.fillStyle = '#f2c05a';
    ctx.fillRect(px + 20, py + 14 + flick / 2, 8, 12);
  }

  private drawEvent(ctx: CanvasRenderingContext2D, sim: IslandSim): void {
    const ev = sim.tonight!;
    const pos = eventPosition(ev, sim.clock.hourF);
    const x = ev.kind === 'walker' && sim.saltLineLaid ? Math.min(pos.x, walkerHaltsAt()) : pos.x;
    const p = this.pos(x, pos.y);
    const t = sim.clock.totalMinutes;

    if (ev.kind === 'choir') {
      for (let i = -2; i <= 2; i++) {
        const cp = this.pos(pos.x + i * 2, pos.y);
        if (!cp.visible) continue;
        const bob = Math.sin(t * 0.8 + i) * 5;
        ctx.fillStyle = 'rgba(200, 225, 235, 0.5)';
        ctx.fillRect(cp.sx + 16, cp.sy + 4 + bob, 16, 30);
        ctx.fillStyle = 'rgba(230, 245, 250, 0.7)';
        ctx.fillRect(cp.sx + 19, cp.sy + bob, 10, 10);
      }
      return;
    }
    if (!p.visible) return;
    if (ev.kind === 'walker') {
      const g = ctx.createRadialGradient(p.sx + CELL / 2, p.sy + CELL / 2, 2, p.sx + CELL / 2, p.sy + CELL / 2, 90);
      g.addColorStop(0, 'rgba(180, 230, 190, 0.75)');
      g.addColorStop(1, 'rgba(180, 230, 190, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(p.sx - 90, p.sy - 90, 228, 228);
      ctx.fillStyle = '#eafce8';
      ctx.fillRect(p.sx + 20, p.sy + 14, 8, 12);
    } else {
      // Weeping: fog seeping from the lot.
      for (let i = 0; i < 5; i++) {
        const drift = Math.sin(t * 0.5 + i * 2) * 12;
        ctx.fillStyle = `rgba(210, 218, 228, ${0.16 + (i % 3) * 0.05})`;
        ctx.fillRect(p.sx - 40 + i * 22 + drift, p.sy - 10 + (i % 2) * 18, 46, 20);
      }
    }
  }

  pos(x: number, y: number): { sx: number; sy: number; visible: boolean } {
    const vx = x - this.camX;
    const vy = y - this.camY;
    return { sx: vx * CELL, sy: vy * CELL, visible: vx >= -2 && vx < VIEW_W + 2 && vy >= -2 && vy < VIEW_H + 2 };
  }
}
