import { describe, expect, it } from 'vitest';
import {
  AIM_LIMIT,
  FAR_LIMIT,
  FLIGHT_TIME,
  NEAR_LIMIT,
  NECK_RADIUS,
  RINGS_PER_ROUND,
  ROW_DEPTHS,
  ROW_POINTS,
  createState,
  landingSpot,
  nudgeAim,
  resolveThrow,
  setAim,
  step,
  throwRing,
  type RingTossState,
} from './game';

const dead = () => 0.5;

/** Aims at a bottle, throws dead on and lets the ring land. */
function throwAtBottle(state: RingTossState, index: number) {
  const { x, z } = state.bottles[index];
  setAim(state, x, z);
  expect(throwRing(state, dead)).toBe(true);
  step(state, FLIGHT_TIME);
}

describe('ring toss', () => {
  it('starts with fifteen bottles, ten rings and no score', () => {
    const state = createState();
    expect(state.bottles).toHaveLength(15);
    expect(state.bottles.every((b) => !b.ringed)).toBe(true);
    expect(state.rings).toBe(RINGS_PER_ROUND);
    expect(RINGS_PER_ROUND).toBe(10);
    expect(state.score).toBe(0);
    expect(state.phase).toBe('playing');
  });

  it('scores a ringed bottle by its row, with the back rows worth more', () => {
    expect(ROW_POINTS[0]).toBeLessThan(ROW_POINTS[1]);
    expect(ROW_POINTS[1]).toBeLessThan(ROW_POINTS[2]);
    for (const row of ROW_DEPTHS.keys()) {
      const state = createState();
      const index = state.bottles.findIndex((b) => b.row === row);
      throwAtBottle(state, index);
      expect(state.score).toBe(ROW_POINTS[row]);
      expect(state.bottles[index].ringed).toBe(true);
      expect(state.last).toEqual({ kind: 'ringer', bottle: index, points: ROW_POINTS[row] });
    }
  });

  it('hits a bottle neck within the neck radius and misses outside it', () => {
    const { bottles } = createState();
    const b = bottles[7];
    expect(resolveThrow(b.x + NECK_RADIUS * 0.9, b.z, bottles).kind).toBe('ringer');
    expect(resolveThrow(b.x, b.z - NECK_RADIUS * 0.9, bottles).kind).toBe('ringer');
    expect(resolveThrow(b.x + NECK_RADIUS * 1.1, b.z, bottles).kind).toBe('miss');
    expect(resolveThrow(0, 0.5, bottles).kind).toBe('miss');
  });

  it('scores nothing for a miss, and nothing for a bottle that already has a ring', () => {
    const state = createState();
    setAim(state, 0, NEAR_LIMIT);
    throwRing(state, dead);
    step(state, FLIGHT_TIME);
    expect(state.last).toEqual({ kind: 'miss' });
    expect(state.score).toBe(0);

    throwAtBottle(state, 0);
    const score = state.score;
    throwAtBottle(state, 0);
    expect(state.last).toEqual({ kind: 'taken', bottle: 0 });
    expect(state.score).toBe(score);
  });

  it('scatters throws more at distance, and lands dead on with a middle roll', () => {
    expect(landingSpot(1, 3, dead)).toEqual({ x: 1, z: 3 });
    const near = landingSpot(0, 3, () => 1).x;
    const far = landingSpot(0, 5, () => 1).x;
    expect(far).toBeGreaterThan(near);
  });

  it('only throws one ring at a time, and none once they run out', () => {
    const state = createState();
    expect(throwRing(state, dead)).toBe(true);
    expect(throwRing(state, dead)).toBe(false);
    expect(state.rings).toBe(RINGS_PER_ROUND - 1);
    step(state, FLIGHT_TIME);
    for (let i = 0; i < RINGS_PER_ROUND - 1; i++) {
      expect(throwRing(state, dead)).toBe(true);
      step(state, FLIGHT_TIME);
    }
    expect(state.rings).toBe(0);
    expect(throwRing(state, dead)).toBe(false);
  });

  it('ends the round once the last ring has landed, and not before', () => {
    const state = createState();
    for (let i = 0; i < RINGS_PER_ROUND; i++) {
      expect(state.phase).toBe('playing');
      throwAtBottle(state, i);
    }
    expect(state.phase).toBe('over');
    expect(state.score).toBe(5 * ROW_POINTS[0] + 5 * ROW_POINTS[1]);
    expect(throwRing(state, dead)).toBe(false);
  });

  it('keeps the aim inside the stall', () => {
    const state = createState();
    setAim(state, 99, 99);
    expect(state.aimX).toBe(AIM_LIMIT);
    expect(state.aimZ).toBe(FAR_LIMIT);
    setAim(state, -99, -99);
    expect(state.aimX).toBe(-AIM_LIMIT);
    expect(state.aimZ).toBe(NEAR_LIMIT);
    setAim(state, 0, 4);
    nudgeAim(state, 1, 1, 0.1);
    expect(state.aimX).toBeGreaterThan(0);
    expect(state.aimZ).toBeGreaterThan(4);
  });
});
