// ============================================================
// Gullshead's tick loop: the town clockwork, the tourist mill,
// the night visitations, and the mayor's levers. Pure code —
// AI only ever supplies words on top of this.
// ============================================================

import { GameClock } from '../town/clock';
import { LOCALS, currentStop, makeTourist, type LocalDef, type TouristDef, type ScheduleStop } from './agents';
import { LOTS, findPath, passable, placeById, type WantKind } from './world';
import { COIN_PER_WANT, arrivalsFor, mockReview, nextReputation, starsFor, type TouristOutcome } from './economy';
import { CURSE_PAGES, eventForNight, eventPosition, eventPrevented, walkerHaltsAt, type NightEvent } from './events';

const MINUTES_PER_TILE = 4;
export const SEASON_DAYS = 10;

export interface Walker {
  x: number;
  y: number;
  path: Array<{ x: number; y: number }>;
  walkProgress: number;
}

export interface LocalState extends Walker {
  def: LocalDef;
  activity: string;
}

export type TouristPhase = 'arriving' | 'seeking' | 'visiting' | 'idle' | 'bonfire' | 'sleeping' | 'fleeing' | 'departing';

export interface TouristState extends Walker {
  def: TouristDef;
  phase: TouristPhase;
  wantsMet: WantKind[];
  scared: boolean;
  scaredBy?: string;
  sleptRough: boolean;
  visitUntil: number; // clock minutes
  idleHop: number;
}

export interface GazetteEntry {
  day: number;
  stars: number;
  text: string;
}

export type LotState = 'ruined' | 'building' | 'open';

export class IslandSim {
  clock = new GameClock();
  mayor = { x: placeById('office').x, y: placeById('office').y + 3 }; // on the grass below the office steps
  locals: LocalState[];
  tourists: TouristState[] = [];
  lotStates = new Map<string, LotState>();
  buildingSince = new Map<string, number>(); // lotId → day work started

  treasury = 50;
  reputation = 2.0;
  gazette: GazetteEntry[] = [];
  journal: Array<{ title: string; text: string }> = [];
  notes: string[] = []; // toast queue for the UI

  bellRungThisEvening = false;
  saltLineLaid = false;
  bonfireTonight: 'beach' | 'square' | null = null;

  tonight: NightEvent | null = null;
  tonightPrevented = false;
  eventActive = false;

  seasonOver = false;
  ferryStopped = false;
  private lastMorningDay = 0;
  private seenPages = new Set<string>();
  private nightAnnounced = false;

  /** For tests: deterministic tourist seeds. */
  seedBase = 12345;

  constructor() {
    this.clock.totalMinutes = 7 * 60 + 30; // Day 1, 07:30 — ferry due at nine
    this.locals = LOCALS.map((def) => {
      const stop = currentStop(def.schedule, this.clock.hourF);
      const p = placeById(stop.placeId);
      return { def, x: p.x, y: p.y, path: [], walkProgress: 0, activity: stop.activity };
    });
    for (const lot of LOTS) this.lotStates.set(lot.id, 'ruined');
  }

  lotOpen = (lotId: string): boolean => this.lotStates.get(lotId) === 'open';

  say(note: string) {
    this.notes.push(note);
  }

  // ---------------- Tick ----------------

  tick(realMs: number): void {
    if (this.clock.speed === 0 || this.seasonOver) return;
    const beforeMinutes = this.clock.totalMinutes;
    this.clock.advanceReal(realMs);
    const gameMinutes = this.clock.totalMinutes - beforeMinutes;

    this.morningBoundary();
    this.nightLifecycle();

    for (const local of this.locals) this.driveLocal(local, gameMinutes);
    for (const tourist of this.tourists) this.driveTourist(tourist, gameMinutes);

    this.witnessCheck();
  }

  /** 09:00: yesterday's guests file their reviews and today's arrive. */
  private morningBoundary(): void {
    if (this.clock.hourF < 9 || this.clock.day === this.lastMorningDay) return;
    this.lastMorningDay = this.clock.day;

    // Reviews from everyone departing.
    const stars: number[] = [];
    for (const t of this.tourists) {
      const outcome: TouristOutcome = {
        name: t.def.name,
        temper: t.def.temper,
        wants: t.def.wants,
        wantsMet: t.wantsMet,
        scared: t.scared,
        sleptRough: t.sleptRough,
        scaredBy: t.scaredBy,
      };
      const review = mockReview(outcome);
      stars.push(starsFor(outcome));
      this.gazette.unshift({ day: this.clock.day, stars: review.stars, text: review.text });
    }
    if (this.tourists.length > 0) {
      this.reputation = nextReputation(this.reputation, stars);
    } else if (this.clock.day > 1) {
      this.reputation = nextReputation(this.reputation, []);
    }
    this.tourists = [];

    // Construction finishes after a full day of Hobb's hammering.
    for (const [lotId, since] of this.buildingSince) {
      if (this.clock.day > since) {
        this.lotStates.set(lotId, 'open');
        this.buildingSince.delete(lotId);
        const lot = LOTS.find((l) => l.id === lotId)!;
        this.say(`${lot.name} is open. Hobb left an invoice and a level floor.`);
      }
    }

    // Night levers expire with the dawn.
    this.saltLineLaid = false;
    this.bellRungThisEvening = false;
    this.bonfireTonight = null;
    this.tonight = null;
    this.eventActive = false;
    this.nightAnnounced = false;

    // Season end.
    if (this.clock.day > SEASON_DAYS) {
      this.seasonOver = true;
      return;
    }

    // New arrivals, reputation willing.
    const count = arrivalsFor(this.reputation);
    if (count === 0) {
      this.ferryStopped = true;
      this.seasonOver = true;
      this.say('The ferry did not come. Captain Ferrick sent a note: “Nobody aboard. Word’s ashore, Mayor.”');
      return;
    }
    const pier = placeById('pier-end');
    for (let i = 0; i < count; i++) {
      const def = makeTourist(this.seedBase + this.clock.day * 97 + i * 31);
      this.tourists.push({
        def, x: pier.x, y: pier.y, path: [], walkProgress: 0,
        phase: 'arriving', wantsMet: [], scared: false, sleptRough: false, visitUntil: 0, idleHop: 0,
      });
    }
    this.say(`The ferry docks: ${count} visitor${count === 1 ? '' : 's'} down the gangway.`);
  }

  private nightLifecycle(): void {
    const h = this.clock.hourF < 12 ? this.clock.hourF + 24 : this.clock.hourF;
    if (!this.tonight && this.clock.hourF >= 21 && this.clock.hourF < 24) {
      this.tonight = eventForNight(this.clock.day);
    }
    if (!this.tonight) return;

    const withinWindow = h >= this.tonight.startHour && h <= this.tonight.endHour;
    if (withinWindow && !this.nightAnnounced) {
      this.nightAnnounced = true;
      const check = eventPrevented(this.tonight, {
        bellRungThisEvening: this.bellRungThisEvening,
        saltLineLaid: this.saltLineLaid,
      });
      this.tonightPrevented = check.prevented;
      if (check.prevented) this.say(check.note);
    }
    this.eventActive = withinWindow && !this.tonightPrevented;
    // The Walker, even prevented, flickers at the line's edge briefly — handled in render.
  }

  private driveLocal(local: LocalState, gameMinutes: number): void {
    // Hobb works the site while something is building.
    let stop: ScheduleStop;
    const underWork = [...this.buildingSince.keys()][0];
    if (local.def.id === 'hobb' && underWork && this.clock.hourF >= 8 && this.clock.hourF < 18) {
      const lot = LOTS.find((l) => l.id === underWork)!;
      stop = { at: 8, placeId: '', activity: `hammering at ${lot.ruinedName}` };
      this.walkToward(local, lot.doorX, lot.doorY + 1, gameMinutes);
      local.activity = this.at(local, lot.doorX, lot.doorY + 1) ? stop.activity : 'hauling timber';
      return;
    }
    stop = currentStop(local.def.schedule, this.clock.hourF);
    const p = placeById(stop.placeId);
    this.walkToward(local, p.x, p.y, gameMinutes);
    local.activity = this.at(local, p.x, p.y) ? stop.activity : `off to ${stop.activity}`;
  }

  private driveTourist(t: TouristState, gameMinutes: number): void {
    const hour = this.clock.hourF;

    // Departure march.
    if (hour >= 8 && hour < 9 && t.phase !== 'departing') {
      t.phase = 'departing';
      t.path = [];
    }

    switch (t.phase) {
      case 'arriving': {
        const sq = placeById('square');
        this.walkToward(t, sq.x, sq.y, gameMinutes);
        if (this.at(t, sq.x, sq.y)) t.phase = 'seeking';
        break;
      }
      case 'seeking': {
        if (hour >= 21.5) return this.nightRouting(t, gameMinutes);
        const want = t.def.wants.find((w) => !t.wantsMet.includes(w));
        const lot = want ? LOTS.find((l) => l.want === want && this.lotOpen(l.id)) : undefined;
        if (lot) {
          this.walkToward(t, lot.anchorX, lot.anchorY, gameMinutes);
          if (this.at(t, lot.anchorX, lot.anchorY)) {
            t.phase = 'visiting';
            t.visitUntil = this.clock.totalMinutes + 90;
            t.wantsMet.push(lot.want);
            this.treasury += COIN_PER_WANT;
            this.say(`${t.def.name} is delighted with ${lot.name}. +${COIN_PER_WANT} coin.`);
          }
        } else {
          t.phase = 'idle';
        }
        break;
      }
      case 'visiting': {
        if (hour >= 21.5) return this.nightRouting(t, gameMinutes);
        if (this.clock.totalMinutes >= t.visitUntil) t.phase = 'seeking';
        break;
      }
      case 'idle': {
        if (hour >= 21.5) return this.nightRouting(t, gameMinutes);
        // Wander the sights, underwhelmed.
        const spots = ['square', 'beach', 'main-street', 'pier-top'];
        const target = placeById(spots[t.idleHop % spots.length]);
        this.walkToward(t, target.x, target.y, gameMinutes);
        if (this.at(t, target.x, target.y)) {
          t.idleHop += 1;
          const want = t.def.wants.find((w) => !t.wantsMet.includes(w));
          if (want && Math.random() < 0.002 * gameMinutes) {
            this.say(`${t.def.name} grumbles about the lack of ${want === 'fun' ? 'anything to do' : want}.`);
          }
        }
        if (t.def.wants.some((w) => !t.wantsMet.includes(w))) t.phase = 'seeking';
        break;
      }
      case 'bonfire': {
        const site = placeById(this.bonfireTonight === 'beach' ? 'beach' : 'square');
        this.walkToward(t, site.x, site.y, gameMinutes);
        const hh = hour < 12 ? hour + 24 : hour;
        if (hh >= 24.5) t.phase = 'sleeping';
        break;
      }
      case 'sleeping': {
        const inn = LOTS.find((l) => l.id === 'inn')!;
        if (this.lotOpen('inn')) {
          this.walkToward(t, inn.anchorX, inn.anchorY, gameMinutes);
        } else {
          t.sleptRough = true;
          const bench = placeById('square');
          this.walkToward(t, bench.x + (t.idleHop % 3) - 1, bench.y + 1, gameMinutes);
        }
        break;
      }
      case 'fleeing': {
        const pier = placeById('pier-top');
        this.walkToward(t, pier.x, pier.y, gameMinutes);
        break;
      }
      case 'departing': {
        const pier = placeById('pier-end');
        this.walkToward(t, pier.x, pier.y, gameMinutes);
        break;
      }
    }
  }

  private nightRouting(t: TouristState, gameMinutes: number): void {
    if (this.bonfireTonight) {
      t.phase = 'bonfire';
    } else {
      t.phase = 'sleeping';
    }
    this.driveTourist(t, gameMinutes);
  }

  /** A tourist safe in a repaired inn sees nothing. Everyone else might. */
  private witnessCheck(): void {
    if (!this.eventActive || !this.tonight) return;
    const pos = eventPosition(this.tonight, this.clock.hourF);
    const effX = this.tonight.kind === 'walker' && this.saltLineLaid ? Math.min(pos.x, walkerHaltsAt()) : pos.x;

    for (const t of this.tourists) {
      if (t.scared) continue;
      const safeInside = t.phase === 'sleeping' && this.lotOpen('inn') && this.at(t, LOTS[0].anchorX, LOTS[0].anchorY, 2);
      if (safeInside) continue;
      if (Math.abs(t.x - effX) + Math.abs(t.y - pos.y) <= 5) {
        t.scared = true;
        t.scaredBy = this.tonight.label;
        t.phase = 'fleeing';
        t.path = [];
        this.say(`${t.def.name} saw it. Saw ALL of it. They are heading for the pier at speed.`);
      }
    }

    // The mayor, witnessing up close, learns something instead.
    if (Math.abs(this.mayor.x - effX) + Math.abs(this.mayor.y - pos.y) <= 4) {
      const page = CURSE_PAGES[this.tonight.kind];
      if (!this.seenPages.has(this.tonight.kind)) {
        this.seenPages.add(this.tonight.kind);
        this.journal.push(page);
        this.say(`You stood close enough to understand something. “${page.title}” added to your journal.`);
      }
    }
  }

  // ---------------- Movement plumbing ----------------

  private at(w: { x: number; y: number }, x: number, y: number, slack = 0): boolean {
    return Math.abs(w.x - x) <= slack && Math.abs(w.y - y) <= slack || (w.x === x && w.y === y);
  }

  private walkToward(w: Walker, tx: number, ty: number, gameMinutes: number): void {
    const arrived = w.x === tx && w.y === ty;
    const pathGood = w.path.length > 0 && w.path[w.path.length - 1].x === tx && w.path[w.path.length - 1].y === ty;
    if (!arrived && !pathGood) {
      w.path = findPath(w.x, w.y, tx, ty, this.lotOpen) ?? [];
      w.walkProgress = 0;
    }
    if (w.path.length === 0) return;
    w.walkProgress += gameMinutes;
    while (w.walkProgress >= MINUTES_PER_TILE && w.path.length > 0) {
      w.walkProgress -= MINUTES_PER_TILE;
      const next = w.path.shift()!;
      w.x = next.x;
      w.y = next.y;
    }
  }

  // ---------------- Mayor verbs ----------------

  tryMoveMayor(dx: number, dy: number): boolean {
    if (this.clock.speed === 0 || this.seasonOver) return false;
    const nx = this.mayor.x + dx;
    const ny = this.mayor.y + dy;
    if (!passable(nx, ny, this.lotOpen)) return false;
    this.mayor.x = nx;
    this.mayor.y = ny;
    return true;
  }

  nearbyPeople(): Array<LocalState | TouristState> {
    const all: Array<LocalState | TouristState> = [...this.locals, ...this.tourists];
    return all.filter((a) => Math.abs(a.x - this.mayor.x) <= 1 && Math.abs(a.y - this.mayor.y) <= 1);
  }

  nearPlace(placeId: string, slack = 1): boolean {
    const p = placeById(placeId);
    return Math.abs(this.mayor.x - p.x) <= slack && Math.abs(this.mayor.y - p.y) <= slack;
  }

  ringBell(): void {
    if (!this.nearPlace('chapel-bell', 2)) {
      this.say('You are not at the chapel bell.');
      return;
    }
    const h = this.clock.hourF;
    if (h >= 17 && h < 21) {
      this.bellRungThisEvening = true;
      this.say('You ring the old bell. It sounds smaller than it should, and further away. Somewhere below the water, something settles.');
    } else {
      this.say('You ring the bell. A gull leaves. Nothing else changes — Maren said BEFORE nine, of an evening.');
    }
  }

  orderRepair(lotId: string): void {
    const lot = LOTS.find((l) => l.id === lotId);
    if (!lot) return;
    if (this.lotStates.get(lotId) !== 'ruined') {
      this.say(`${lot.name} is already seen to.`);
      return;
    }
    if (this.treasury < lot.cost) {
      this.say(`The treasury holds ${this.treasury} coin. ${lot.name} needs ${lot.cost}. Mayoral arithmetic fails.`);
      return;
    }
    this.treasury -= lot.cost;
    this.lotStates.set(lotId, 'building');
    this.buildingSince.set(lotId, this.clock.day);
    this.say(`Posted: repair ${lot.ruinedName}. Hobb tips his cap and produces, from nowhere, an enormous hammer.`);
  }

  scheduleBonfire(site: 'beach' | 'square'): void {
    if (this.treasury < 10) {
      this.say('A bonfire costs 10 coin (wood, marshmallows, liability).');
      return;
    }
    this.treasury -= 10;
    this.bonfireTonight = site;
    this.say(`Posted: BONFIRE TONIGHT at the ${site}. Attendance mandatory in spirit.`);
  }

  laySaltLine(): void {
    if (this.saltLineLaid) {
      this.say('The salt line is already down.');
      return;
    }
    if (this.treasury < 5) {
      this.say('Salt costs 5 coin. The grocer knows why you want it and charges accordingly.');
      return;
    }
    this.treasury -= 5;
    this.saltLineLaid = true;
    this.say('You lay a fat white line of salt across the north lane. It looks ridiculous. Old Edda nods approvingly.');
  }

  seasonReport(): { rep: number; coin: number; pages: number; failed: boolean } {
    return { rep: this.reputation, coin: this.treasury, pages: this.journal.length, failed: this.ferryStopped };
  }
}
