import { describe, expect, it } from 'vitest';
import {
  BURNT_GRAMS,
  CONE,
  PINK_GRAMS,
  ROUND_SECONDS,
  SPAWN_INTERVAL,
  catchWisp,
  createState,
  flossRadius,
  moveCone,
  nudgeCone,
  spawnInterval,
  spawnWisp,
  step,
  timeLeft,
  type Wisp,
} from './game';

const pink = (x: number): Wisp => ({ x, y: CONE.y, vx: 0, vy: 0, kind: 'pink' });
const burnt = (x: number): Wisp => ({ ...pink(x), kind: 'burnt' });
/** A random function that returns the given values in turn, repeating the last. */
const sequence =
  (...values: number[]) =>
  () =>
    values.length > 1 ? values.shift()! : values[0];

describe('candy floss', () => {
  it('starts with an empty cone, a full clock and no wisps', () => {
    const state = createState();
    expect(state.score).toBe(0);
    expect(state.wisps).toHaveLength(0);
    expect(timeLeft(state)).toBe(ROUND_SECONDS);
    expect(state.phase).toBe('playing');
  });

  it('adds 10 grams for a pink wisp', () => {
    const state = createState();
    catchWisp(state, pink(0));
    expect(state.score).toBe(PINK_GRAMS);
  });

  it('takes 25 grams off for a burnt wisp', () => {
    const state = createState();
    state.score = 40;
    catchWisp(state, burnt(0));
    expect(state.score).toBe(40 - BURNT_GRAMS);
  });

  it('never takes the cone below 0 grams', () => {
    const state = createState();
    state.score = 10;
    catchWisp(state, burnt(0));
    expect(state.score).toBe(0);
    catchWisp(state, burnt(0));
    expect(state.score).toBe(0);
  });

  it('catches a wisp that reaches the cone and lets a missed one fall past', () => {
    const state = createState();
    state.wisps = [pink(state.coneX), pink(state.coneX + CONE.halfWidth * 3)];
    step(state, 0);
    expect(state.score).toBe(PINK_GRAMS);
    expect(state.wisps).toHaveLength(1);
  });

  it('catches a burnt wisp during play, floored at 0', () => {
    const state = createState();
    state.wisps = [burnt(state.coneX)];
    step(state, 0);
    expect(state.score).toBe(0);
    expect(state.wisps).toHaveLength(0);
  });

  it('ends the round at 30 seconds, and not before', () => {
    const state = createState();
    const random = sequence(0.5);
    for (let t = 0; t < ROUND_SECONDS - 0.1; t += 0.05) step(state, 0.05, random);
    expect(state.phase).toBe('playing');
    step(state, 0.2, random);
    expect(state.phase).toBe('over');
    expect(timeLeft(state)).toBe(0);
  });

  it('stops changing once the round is over', () => {
    const state = createState();
    state.score = 30;
    step(state, ROUND_SECONDS, sequence(0.5));
    state.wisps = [pink(state.coneX)];
    step(state, 0.1);
    expect(state.score).toBe(30);
  });

  it('spawns wisps deterministically from the random function', () => {
    const a = spawnWisp(createState(), sequence(0.25, 0.5, 0.5, 0.9));
    const b = spawnWisp(createState(), sequence(0.25, 0.5, 0.5, 0.9));
    expect(a).toEqual(b);
    expect(a.kind).toBe('pink');
    expect(spawnWisp(createState(), sequence(0.25, 0.5, 0.5, 0.1)).kind).toBe('burnt');
  });

  it('spawns wisps faster as the round goes on', () => {
    expect(spawnInterval(0)).toBe(SPAWN_INTERVAL.start);
    expect(spawnInterval(ROUND_SECONDS)).toBe(SPAWN_INTERVAL.end);
    expect(spawnInterval(20)).toBeLessThan(spawnInterval(10));
  });

  it('keeps the cone inside the booth', () => {
    const state = createState();
    moveCone(state, -100);
    expect(state.coneX).toBe(CONE.halfWidth);
    const x = state.coneX;
    nudgeCone(state, 1, 0.1);
    expect(state.coneX).toBeCloseTo(x + CONE.speed * 0.1);
  });

  it('grows the floss on the cone as the score goes up', () => {
    expect(flossRadius(100)).toBeGreaterThan(flossRadius(10));
  });
});
