import { describe, it, expect } from 'vitest';
import { validateSheet } from '../src/ai/generator';

const rawBase = {
  townName: 'Brackmoor',
  overview: 'A town.',
  locations: [
    { id: 'quay', name: 'The Quay', sealed: false, description: '' },
    { id: 'office', name: 'Assize Office', sealed: false, description: '' },
    { id: 'crawl', name: 'The Crawl', sealed: true, description: '' },
  ],
  hosts: [
    { id: 'a', name: 'Ana', birthYear: 30, deathYear: 95, role: 'clerk', homeLocation: 'office', seed: '' },
    { id: 'b', name: 'Bel', birthYear: 50, deathYear: 90, role: 'fisher', homeLocation: 'nowhere', seed: '' },
  ],
  primePoetic: 'He cannot end while the quay holds.',
  primeConditions: [
    { id: 'prime-1', poetic: 'p1', hiddenCondition: 'Fulfilled when: x', roles: [{ label: 'the one' }], tags: ['A', 'b'] },
    { id: 'prime-2', poetic: 'p2', hiddenCondition: 'Fulfilled when: y', roles: [{ label: 'the two' }], tags: ['c'] },
    { id: 'prime-3', poetic: 'p3', hiddenCondition: 'Fulfilled when: z', roles: [{ label: 'the three' }], tags: ['d'] },
  ],
  looseProphecies: [
    { id: 'loose-1', poetic: 'l1', hiddenCondition: 'Fulfilled when: w', roles: [{ label: 'the bird' }], tags: ['E'], sealedSketch: 'If neglected: bad.' },
  ],
};

describe('generated era validation', () => {
  it('clamps human lifespans to the fifty-year ceiling', () => {
    const sheet = validateSheet(structuredClone(rawBase));
    const ana = sheet.hosts.find((h) => h.id === 'a')!;
    expect(ana.deathYear - ana.birthYear).toBeLessThanOrEqual(50);
  });

  it('repairs unknown home locations and lowercases tags', () => {
    const sheet = validateSheet(structuredClone(rawBase));
    const bel = sheet.hosts.find((h) => h.id === 'b')!;
    expect(sheet.locations.some((l) => l.id === bel.homeLocation)).toBe(true);
    expect(sheet.locations.find((l) => l.id === bel.homeLocation)!.sealed).toBe(false);
    expect(sheet.primeConditions[0].tags).toEqual(['a', 'b']);
  });

  it('keeps exactly one sealed location and roosts the rat there', () => {
    const raw = structuredClone(rawBase);
    raw.locations[0].sealed = true; // two sealed now
    const sheet = validateSheet(raw);
    expect(sheet.locations.filter((l) => l.sealed).length).toBe(1);
    const rat = sheet.hosts.find((h) => h.id === 'rat-1')!;
    expect(sheet.locations.find((l) => l.id === rat.homeLocation)!.sealed).toBe(true);
  });

  it('adds animal hosts with animal lifespans (Canon 1)', () => {
    const sheet = validateSheet(structuredClone(rawBase));
    const rat = sheet.hosts.find((h) => h.species === 'rat')!;
    expect(rat.deathYear - rat.birthYear).toBeLessThanOrEqual(4);
    expect(sheet.hosts.some((h) => h.species === 'raven')).toBe(true);
  });

  it('refuses an era without a full prime prophecy', () => {
    const raw = structuredClone(rawBase);
    raw.primeConditions = raw.primeConditions.slice(0, 2);
    expect(() => validateSheet(raw)).toThrow();
  });
});
