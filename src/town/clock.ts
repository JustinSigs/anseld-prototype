// Game time. One real second = six game minutes at 1x.
// A full day passes in four real minutes — long enough to watch,
// short enough that schedules visibly turn.

export class GameClock {
  /** Minutes since Day 1, 00:00. Starts at 06:50 — just before the town wakes. */
  totalMinutes = 6 * 60 + 50;
  speed: 0 | 1 | 2 | 4 = 1;

  advanceReal(realMs: number): void {
    this.totalMinutes += (realMs / 1000) * 6 * this.speed;
  }

  get day(): number {
    return Math.floor(this.totalMinutes / (24 * 60)) + 1;
  }

  get hour(): number {
    return Math.floor(this.totalMinutes / 60) % 24;
  }

  get minute(): number {
    return Math.floor(this.totalMinutes) % 60;
  }

  /** Fractional hour of day, for schedules and light. */
  get hourF(): number {
    return (this.totalMinutes / 60) % 24;
  }

  get label(): string {
    return `Day ${this.day} — ${String(this.hour).padStart(2, '0')}:${String(this.minute).padStart(2, '0')}`;
  }

  /** 0 = full day, 1 = full night, smooth at dawn (5–7) and dusk (19–21). */
  get darkness(): number {
    const h = this.hourF;
    if (h >= 7 && h < 19) return 0;
    if (h >= 5 && h < 7) return 1 - (h - 5) / 2;
    if (h >= 19 && h < 21) return (h - 19) / 2;
    return 1;
  }
}
