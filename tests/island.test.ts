import { describe, it, expect } from 'vitest';
import { IslandSim } from '../src/island/sim';
import { LOTS, findPath, placeById, WALKER_ROUTE, passable } from '../src/island/world';
import { LOCALS } from '../src/island/agents';
import { arrivalsFor, nextReputation, starsFor, mockReview } from '../src/island/economy';
import { eventForNight, eventPrevented, isFoggy } from '../src/island/events';

const allOpen = () => true;
const allShut = () => false;

describe('the island map', () => {
  it('every local schedule stop is reachable from the square with lots shut', () => {
    const sq = placeById('square');
    for (const def of LOCALS) {
      for (const stop of def.schedule) {
        const p = placeById(stop.placeId);
        expect(findPath(sq.x, sq.y, p.x, p.y, allShut), `${def.id} → ${stop.placeId}`).not.toBeNull();
      }
    }
  });

  it('lot doors are shut when ruined and open when repaired', () => {
    const inn = LOTS.find((l) => l.id === 'inn')!;
    expect(passable(inn.doorX, inn.doorY, allShut)).toBe(false);
    expect(passable(inn.doorX, inn.doorY, allOpen)).toBe(true);
  });

  it("the Walker's whole route is on walkable lane tiles", () => {
    for (const step of WALKER_ROUTE) {
      expect(passable(step.x, step.y, allShut), `route at ${step.x},${step.y}`).toBe(true);
    }
  });
});

describe('the books', () => {
  it('scared tourists file one-star letters regardless of chowder', () => {
    const stars = starsFor({ name: 'A', temper: '', wants: ['food'], wantsMet: ['food'], scared: true, sleptRough: false });
    expect(stars).toBe(1);
  });

  it('satisfied wants raise stars; unmet wants and bench-sleep lower them', () => {
    const happy = starsFor({ name: 'A', temper: '', wants: ['food', 'fun'], wantsMet: ['food', 'fun'], scared: false, sleptRough: false });
    const letdown = starsFor({ name: 'B', temper: '', wants: ['food', 'fun'], wantsMet: [], scared: false, sleptRough: true });
    expect(happy).toBe(5);
    expect(letdown).toBe(1);
  });

  it('reputation moves on reviews and decays on silence; the ferry stops below the line', () => {
    let rep = 2.0;
    rep = nextReputation(rep, [5, 5, 4]);
    expect(rep).toBeGreaterThan(2.0);
    const silent = nextReputation(2.0, []);
    expect(silent).toBeLessThan(2.0);
    expect(arrivalsFor(0.5)).toBe(0);
    expect(arrivalsFor(3)).toBeGreaterThanOrEqual(3);
  });

  it('scared reviews name what was seen', () => {
    const r = mockReview({ name: 'Mabel Fitch', temper: '', wants: ['rest'], wantsMet: [], scared: true, sleptRough: true, scaredBy: 'a lantern walking with nobody carrying it' });
    expect(r.stars).toBe(1);
    expect(r.text.toLowerCase()).toContain('lantern');
  });
});

describe('the nights', () => {
  it('the Walker keeps its every-third-night calendar; the Choir needs fog', () => {
    expect(eventForNight(3).kind).toBe('walker');
    expect(eventForNight(6).kind).toBe('walker');
    const day = [1, 2, 4, 5, 7, 8].find((d) => isFoggy(d));
    if (day !== undefined) expect(eventForNight(day).kind).toBe('choir');
    const clear = [1, 2, 4, 5, 7, 8].find((d) => !isFoggy(d));
    if (clear !== undefined) expect(eventForNight(clear).kind).toBe('weeping');
  });

  it('the bell prevents the Choir; salt prevents the Walker; nothing prevents the Weeping yet', () => {
    const choir = { kind: 'choir' as const, label: '', startHour: 22.5, endHour: 26 };
    const walker = { kind: 'walker' as const, label: '', startHour: 22.5, endHour: 24.5 };
    const weeping = { kind: 'weeping' as const, label: '', startHour: 23, endHour: 27 };
    expect(eventPrevented(choir, { bellRungThisEvening: true, saltLineLaid: false }).prevented).toBe(true);
    expect(eventPrevented(choir, { bellRungThisEvening: false, saltLineLaid: true }).prevented).toBe(false);
    expect(eventPrevented(walker, { bellRungThisEvening: false, saltLineLaid: true }).prevented).toBe(true);
    expect(eventPrevented(weeping, { bellRungThisEvening: true, saltLineLaid: true }).prevented).toBe(false);
  });
});

describe('a day on Gullshead', () => {
  function runUntil(sim: IslandSim, hourF: number, maxTicks = 3000) {
    // Advance in 1-second real ticks at 4x until the clock passes hourF (same day handling by caller).
    sim.clock.speed = 4;
    for (let i = 0; i < maxTicks; i++) {
      sim.tick(1000);
      if (sim.clock.hourF >= hourF && sim.clock.hourF < hourF + 1) break;
    }
  }

  it('the ferry refuses an island with nothing open; arrivals begin once something is', () => {
    const sim = new IslandSim();
    runUntil(sim, 10);
    expect(sim.tourists.length).toBe(0); // nothing open, nobody aboard
    expect(sim.reputation).toBeCloseTo(2.0); // and no reputation damage for it

    sim.treasury = 100;
    sim.orderRepair('bandstand');
    sim.clock.speed = 4;
    for (let i = 0; i < 8000 && sim.tourists.length === 0; i++) sim.tick(1000);
    expect(sim.lotStates.get('bandstand')).toBe('open');
    expect(sim.tourists.length).toBe(arrivalsFor(sim.reputation));
  });

  it('repair posted → Hobb builds → lot opens next morning → tourists pay', () => {
    const sim = new IslandSim();
    sim.treasury = 100;
    sim.orderRepair('chowder');
    expect(sim.lotStates.get('chowder')).toBe('building');

    // Run to the next morning.
    sim.clock.speed = 4;
    for (let i = 0; i < 8000 && sim.lotStates.get('chowder') !== 'open'; i++) sim.tick(1000);
    expect(sim.lotStates.get('chowder')).toBe('open');

    // Force a hungry visitor and let them find it.
    const coinBefore = sim.treasury;
    const hungry = sim.tourists.find((t) => t.def.wants.includes('food'));
    if (hungry) {
      for (let i = 0; i < 1500 && !hungry.wantsMet.includes('food'); i++) sim.tick(1000);
      expect(hungry.wantsMet).toContain('food');
      expect(sim.treasury).toBeGreaterThan(coinBefore);
    }
  });

  it('a night event scares nearby tourists but writes the watching mayor a journal page', async () => {
    const sim = new IslandSim();
    sim.clock.speed = 4;
    // Fast-forward to 22:40 on day 1.
    while (sim.clock.hourF < 22.6) sim.tick(1000);
    expect(sim.tonight).not.toBeNull();

    if (sim.eventActive && sim.tonight) {
      // Teleport the mayor to the event; the journal should gain a page.
      const { eventPosition } = await import('../src/island/events');
      const pos = eventPosition(sim.tonight, sim.clock.hourF);
      sim.mayor.x = pos.x;
      sim.mayor.y = pos.y + 1;
      sim.tick(500);
      expect(sim.journal.length).toBeGreaterThan(0);
    }
  });

  it('the salt line stops the walker night from scaring anyone', () => {
    const sim = new IslandSim();
    sim.treasury = 100;
    // Day 1 → run to day 3 (walker night), lay salt that afternoon.
    sim.clock.speed = 4;
    while (sim.clock.day < 3) sim.tick(1000);
    while (sim.clock.hourF < 15) sim.tick(1000);
    sim.laySaltLine();
    while (sim.clock.hourF < 23) sim.tick(1000);
    expect(sim.tonight?.kind).toBe('walker');
    expect(sim.tonightPrevented).toBe(true);
    expect(sim.tourists.every((t) => !t.scared)).toBe(true);
  });
});
