// ============================================================
// The tick loop: the clockwork itself. Agents walk their days;
// the worn body answers to the player instead; exits hand the
// body back to its schedule, unsteered. Pure code, no AI.
// ============================================================

import { GameClock } from './clock';
import { AGENTS, currentStop, stopTarget, type AgentDef } from './agents';
import { findPath, passable } from './world';

/** Game minutes to cross one tile, walking. */
const MINUTES_PER_TILE = 5;

export interface AgentState {
  def: AgentDef;
  x: number;
  y: number;
  path: Array<{ x: number; y: number }>;
  /** Minutes of walking progress toward the next tile. */
  walkProgress: number;
  activity: string;
  /** Player-worn agents ignore their schedule. */
  worn: boolean;
}

export class TownSim {
  clock = new GameClock();
  agents: AgentState[];
  playerAgentId: string;
  /** (pairKey → day) — one overheard exchange per pair per day. */
  overheardToday = new Map<string, number>();

  constructor(startHostId = 'merra') {
    this.agents = AGENTS.map((def) => {
      const stop = currentStop(def, this.clock.hourF);
      const target = stopTarget(stop);
      return { def, x: target.x, y: target.y, path: [], walkProgress: 0, activity: stop.activity, worn: false };
    });
    this.playerAgentId = startHostId;
    this.player().worn = true;
  }

  player(): AgentState {
    return this.agents.find((a) => a.def.id === this.playerAgentId)!;
  }

  agentById(id: string): AgentState | undefined {
    return this.agents.find((a) => a.def.id === id);
  }

  /** Advance the world by real milliseconds (scaled by clock speed). */
  tick(realMs: number): void {
    if (this.clock.speed === 0) return;
    const before = this.clock.totalMinutes;
    this.clock.advanceReal(realMs);
    const gameMinutes = this.clock.totalMinutes - before;

    for (const agent of this.agents) {
      if (agent.worn) continue;
      this.driveAgent(agent, gameMinutes);
    }
  }

  private driveAgent(agent: AgentState, gameMinutes: number): void {
    const stop = currentStop(agent.def, this.clock.hourF);
    const target = stopTarget(stop);

    // New destination? Path toward it.
    const atTarget = agent.x === target.x && agent.y === target.y;
    const pathEndsAtTarget =
      agent.path.length > 0 && agent.path[agent.path.length - 1].x === target.x && agent.path[agent.path.length - 1].y === target.y;
    if (!atTarget && !pathEndsAtTarget) {
      agent.path = findPath(agent.def.species, agent.x, agent.y, target.x, target.y) ?? [];
      agent.walkProgress = 0;
    }
    agent.activity = atTarget ? stop.activity : `heading to ${stop.activity}`;

    // Walk.
    if (agent.path.length > 0) {
      agent.walkProgress += gameMinutes;
      while (agent.walkProgress >= MINUTES_PER_TILE && agent.path.length > 0) {
        agent.walkProgress -= MINUTES_PER_TILE;
        const next = agent.path.shift()!;
        agent.x = next.x;
        agent.y = next.y;
      }
    }
  }

  /** Player movement: one tile, species collision, blocked by other bodies. */
  tryMovePlayer(dx: number, dy: number): boolean {
    if (this.clock.speed === 0) return false; // a paused world holds everyone
    const p = this.player();
    const nx = p.x + dx;
    const ny = p.y + dy;
    if (!passable(p.def.species, nx, ny)) return false;
    if (this.agents.some((a) => !a.worn && a.x === nx && a.y === ny)) return false;
    p.x = nx;
    p.y = ny;
    return true;
  }

  /** Agents adjacent to the player (for talk/possess). */
  adjacentAgents(): AgentState[] {
    const p = this.player();
    return this.agents.filter((a) => !a.worn && Math.abs(a.x - p.x) + Math.abs(a.y - p.y) === 1);
  }

  /**
   * Possess an adjacent agent. The old body resumes its day, unsteered,
   * from wherever you left it standing.
   */
  possess(targetId: string): { ok: boolean; reason?: string } {
    const target = this.agentById(targetId);
    if (!target) return { ok: false, reason: 'No such body.' };
    const p = this.player();
    if (Math.abs(target.x - p.x) + Math.abs(target.y - p.y) !== 1) {
      return { ok: false, reason: 'Too far. Stand beside them.' };
    }
    p.worn = false;
    p.path = [];
    target.worn = true;
    target.path = [];
    this.playerAgentId = targetId;
    return { ok: true };
  }

  /**
   * Pairs of unworn agents standing adjacent to each other near the player —
   * conversations you could drift close enough to catch. Once per pair per day.
   */
  overhearablePairs(radius = 3): Array<[AgentState, AgentState]> {
    const p = this.player();
    const out: Array<[AgentState, AgentState]> = [];
    const idle = this.agents.filter((a) => !a.worn && a.path.length === 0 && a.def.species === 'human');
    for (let i = 0; i < idle.length; i++) {
      for (let j = i + 1; j < idle.length; j++) {
        const a = idle[i];
        const b = idle[j];
        if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) > 2) continue;
        const near = Math.abs(a.x - p.x) + Math.abs(a.y - p.y) <= radius || Math.abs(b.x - p.x) + Math.abs(b.y - p.y) <= radius;
        if (!near) continue;
        const key = [a.def.id, b.def.id].sort().join('+');
        if (this.overheardToday.get(key) === this.clock.day) continue;
        out.push([a, b]);
      }
    }
    return out;
  }

  markOverheard(a: AgentState, b: AgentState): void {
    const key = [a.def.id, b.def.id].sort().join('+');
    this.overheardToday.set(key, this.clock.day);
  }
}
