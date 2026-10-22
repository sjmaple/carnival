import { describe, expect, it } from 'vitest';
import {
  AIM_LIMIT,
  BALLS_PER_ROUND,
  COCONUT_COUNT,
  COCONUT_RADIUS,
  POINTS,
  createState,
  nudgeAim,
  resolveThrow,
  setAim,
  startCharge,
  step,
  throwBall,
  type CoconutShyState,
} from './game';

const fixed = () => 0.5;
/** Power that brings the ball in at the height of a coconut's centre. */
const ON_TARGET = 0.6;

/** Throws one ball at `aimX` with `power` and lets it fly until it lands or hits. */
function throwAt(state: CoconutShyState, aimX: number, power: number) {
  setAim(state, aimX);
  startCharge(state);
  state.power = power;
  expect(throwBall(state)).toBe(true);
  for (let i = 0; i < 200 && state.ball; i++) step(state, 0.01, fixed);
  expect(state.ball).toBeNull();
}

describe('coconut shy', () => {
  it('starts with five coconuts up, six balls and no score', () => {
    const state = createState();
    expect(state.coconuts).toHaveLength(COCONUT_COUNT);
    expect(state.coconuts.every((c) => !c.down)).toBe(true);
    expect(state.balls).toBe(BALLS_PER_ROUND);
    expect(state.score).toBe(0);
    expect(state.phase).toBe('playing');
  });

  it('charges power while held, up to full', () => {
    const state = createState();
    startCharge(state);
    step(state, 0.75);
    expect(state.power).toBeCloseTo(0.5);
    step(state, 5);
    expect(state.power).toBe(1);
  });

  it('keeps the aim inside the stall', () => {
    const state = createState();
    setAim(state, 99);
    expect(state.aimX).toBe(AIM_LIMIT);
    nudgeAim(state, -1, 0.4);
    expect(state.aimX).toBeLessThan(AIM_LIMIT);
  });

  it('drops a weak throw short of the coconuts for no points', () => {
    const state = createState();
    throwAt(state, state.coconuts[2].x, 0);
    expect(state.last).toBe('short');
    expect(state.score).toBe(0);
    expect(state.balls).toBe(BALLS_PER_ROUND - 1);
    expect(state.coconuts.every((c) => !c.down && c.wobble === 0)).toBe(true);
  });

  it('sails a full-power throw over the top', () => {
    const state = createState();
    throwAt(state, state.coconuts[2].x, 1);
    expect(state.last).toBe('over');
    expect(state.score).toBe(0);
  });

  it('knocks a coconut off with a strong, central hit', () => {
    const state = createState();
    throwAt(state, state.coconuts[1].x, ON_TARGET);
    expect(state.last).toBe('knock');
    expect(state.coconuts[1].down).toBe(true);
    expect(state.score).toBe(POINTS.knock);
  });

  it('only wobbles a coconut on a glancing hit', () => {
    const state = createState();
    throwAt(state, state.coconuts[3].x + COCONUT_RADIUS, ON_TARGET);
    expect(state.last).toBe('wobble');
    expect(state.coconuts[3].down).toBe(false);
    expect(state.coconuts[3].wobble).toBeGreaterThan(0);
    expect(state.score).toBe(POINTS.wobble);
  });

  it('wobbles by an amount from the random function', () => {
    const low = createState();
    const high = createState();
    const aim = low.coconuts[0].x + COCONUT_RADIUS;
    const outcome = resolveThrow({ aimX: aim, speed: 10.6, t: 0 }, low.coconuts);
    expect(outcome.kind).toBe('wobble');
    low.ball = { aimX: aim, speed: 10.6, t: outcome.time };
    high.ball = { aimX: aim, speed: 10.6, t: outcome.time };
    step(low, 0, () => 0);
    step(high, 0, () => 1);
    expect(high.coconuts[0].wobble).toBeGreaterThan(low.coconuts[0].wobble);
  });

  it('misses between the coconuts', () => {
    const state = createState();
    throwAt(state, (state.coconuts[0].x + state.coconuts[1].x) / 2, ON_TARGET);
    expect(state.last).toBe('wide');
    expect(state.score).toBe(0);
  });

  it('ends the round with a bonus when all five coconuts are down', () => {
    const state = createState();
    for (const coconut of state.coconuts) throwAt(state, coconut.x, ON_TARGET);
    expect(state.coconuts.every((c) => c.down)).toBe(true);
    expect(state.phase).toBe('over');
    expect(state.balls).toBe(1);
    expect(state.score).toBe(5 * POINTS.knock + POINTS.clearBonus + POINTS.ballLeft);
  });

  it('ends the round when the balls run out, with no bonus', () => {
    const state = createState();
    throwAt(state, state.coconuts[0].x, ON_TARGET);
    for (let i = 1; i < BALLS_PER_ROUND; i++) {
      expect(state.phase).toBe('playing');
      throwAt(state, state.coconuts[2].x, 0);
    }
    expect(state.balls).toBe(0);
    expect(state.phase).toBe('over');
    expect(state.score).toBe(POINTS.knock);
    expect(throwBall(state)).toBe(false);
  });

  it('keeps playing while the last ball is in the air', () => {
    const state = createState();
    state.balls = 1;
    startCharge(state);
    throwBall(state);
    step(state, 0.01);
    expect(state.phase).toBe('playing');
  });

  it('throws only one ball at a time', () => {
    const state = createState();
    expect(throwBall(state)).toBe(true);
    expect(throwBall(state)).toBe(false);
    expect(state.balls).toBe(BALLS_PER_ROUND - 1);
  });
});
