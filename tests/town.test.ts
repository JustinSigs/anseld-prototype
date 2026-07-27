import { describe, it, expect } from 'vitest';
import { GameClock } from '../src/town/clock';
import { findPath, passable, placeById, Tile, tileAt } from '../src/town/world';
import { AGENTS, currentStop } from '../src/town/agents';
import { TownSim } from '../src/town/sim';

describe('the clock', () => {
  it('advances six game minutes per real second at 1x, scaled by speed', () => {
    const c = new GameClock();
    const start = c.totalMinutes;
    c.advanceReal(1000);
    expect(c.totalMinutes - start).toBeCloseTo(6);
    c.speed = 4;
    c.advanceReal(1000);
    expect(c.totalMinutes - start).toBeCloseTo(6 + 24);
    c.speed = 0;
    c.advanceReal(5000);
    expect(c.totalMinutes - start).toBeCloseTo(30);
  });

  it('is dark at night, light at noon, between at dawn', () => {
    const c = new GameClock();
    c.totalMinutes = 12 * 60;
    expect(c.darkness).toBe(0);
    c.totalMinutes = 23 * 60;
    expect(c.darkness).toBe(1);
    c.totalMinutes = 6 * 60;
    expect(c.darkness).toBeGreaterThan(0);
    expect(c.darkness).toBeLessThan(1);
  });
});

describe('the town grid — canon as collision', () => {
  it('humans cannot enter the flue or the vault; rats can', () => {
    const flue = placeById('flue-mouth'); // street-side tile beside the flue
    expect(passable('human', flue.x, flue.y)).toBe(true);
    expect(passable('human', 11, 10)).toBe(false); // the crawl
    expect(passable('rat', 11, 10)).toBe(true);
    const vault = placeById('vault');
    expect(passable('human', vault.x, vault.y)).toBe(false);
    expect(passable('rat', vault.x, vault.y)).toBe(true);
  });

  it('only ravens cross the water', () => {
    expect(tileAt(2, 27)).toBe(Tile.Water);
    expect(passable('human', 2, 27)).toBe(false);
    expect(passable('rat', 2, 27)).toBe(false);
    expect(passable('raven', 2, 27)).toBe(true);
  });

  it('every scheduled place is reachable by the species scheduled to be there', () => {
    for (const def of AGENTS) {
      for (const stop of def.schedule) {
        const p = placeById(stop.placeId);
        expect(passable(def.species, p.x, p.y), `${def.id} → ${stop.placeId}`).toBe(true);
      }
    }
  });

  it('paths exist between consecutive schedule stops for every agent', () => {
    for (const def of AGENTS) {
      for (let i = 0; i < def.schedule.length; i++) {
        const a = placeById(def.schedule[i].placeId);
        const b = placeById(def.schedule[(i + 1) % def.schedule.length].placeId);
        const path = findPath(def.species, a.x, a.y, b.x, b.y);
        expect(path, `${def.id}: ${def.schedule[i].placeId} → ${def.schedule[(i + 1) % def.schedule.length].placeId}`).not.toBeNull();
      }
    }
  });
});

describe('schedules', () => {
  it('picks the right stop for the hour, with overnight carry-over', () => {
    const merra = AGENTS.find((a) => a.id === 'merra')!;
    expect(currentStop(merra, 8).placeId).toBe('assize');
    expect(currentStop(merra, 12.5).placeId).toBe('tavern');
    expect(currentStop(merra, 22).placeId).toBe('house-west');
    expect(currentStop(merra, 2).placeId).toBe('house-west'); // small hours: still home
  });
});

describe('the sim', () => {
  it('walks an agent toward their next stop as time passes', () => {
    const sim = new TownSim('merra');
    // 06:50 — Dovan should be at/heading to the pier end.
    const dovan = sim.agentById('dovan')!;
    sim.clock.totalMinutes = 11 * 60 + 1; // 11:00 — nets time at dock-base
    for (let i = 0; i < 10; i++) sim.tick(1000); // one game-hour: plenty to walk the pier
    const dock = placeById('dock-base');
    expect(Math.abs(dovan.x - dock.x) + Math.abs(dovan.y - dock.y)).toBeLessThanOrEqual(1);
  });

  it('a worn body ignores its schedule; possession is adjacency-gated and swaps control', () => {
    const sim = new TownSim('merra');
    const merra = sim.player();
    expect(merra.def.id).toBe('merra');

    const far = sim.possess('dovan');
    expect(far.ok).toBe(false);

    // Stand issa next to merra artificially, then possess.
    const issa = sim.agentById('issa')!;
    issa.x = merra.x + 1;
    issa.y = merra.y;
    const res = sim.possess('issa');
    expect(res.ok).toBe(true);
    expect(sim.player().def.id).toBe('issa');
    expect(sim.agentById('merra')!.worn).toBe(false); // handed back to her day, unsteered
  });

  it('player movement respects species rules and a paused world', () => {
    const sim = new TownSim('merra');
    const p = sim.player();
    p.x = 13; // the flue mouth street tile
    p.y = 10;
    expect(sim.tryMovePlayer(-1, 0)).toBe(false); // human vs flue

    sim.clock.speed = 0;
    expect(sim.tryMovePlayer(0, 1)).toBe(false); // paused world holds everyone
  });
});
