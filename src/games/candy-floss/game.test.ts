import { describe, expect, it } from 'vitest';
import {
  BURNT_CHANCE,
  BURNT_GRAMS,
  CONE_HALF_WIDTH,
  CONE_Y,
  PINK_GRAMS,
  ROUND_SECONDS,
  catchWisp,
  createState,
  flossRadius,
  moveCone,
  spawnInterval,
  spawnWisp,
  step,
  timeLeft,
  type Wisp,
} from './game';

const pink: Wisp = { x: 400, y: CONE_Y, vx: 0, vy: 0, kind: 'pink' };
const burnt: Wisp = { ...pink, kind: 'burnt' };
/** A random function that always returns the same value. */
const always = (value: number) => () => value;

describe('candy floss', () => {
  it('starts with an empty cone, no wisps and the full round to play', () => {
    const state = createState();
    expect(state.score).toBe(0);
    expect(state.wisps).toHaveLength(0);
    expect(timeLeft(state)).toBe(ROUND_SECONDS);
    expect(state.phase).toBe('playing');
  });

  it('adds 10 grams for a pink wisp', () => {
    const state = createState();
    catchWisp(state, pink);
    expect(state.score).toBe(PINK_GRAMS);
    expect(PINK_GRAMS).toBe(10);
  });

  it('takes 25 grams off for a burnt wisp', () => {
    const state = createState();
    state.score = 40;
    catchWisp(state, burnt);
    expect(state.score).toBe(40 - BURNT_GRAMS);
    expect(BURNT_GRAMS).toBe(25);
  });

  it('never drops the score below 0', () => {
    const state = createState();
    state.score = 10;
    catchWisp(state, burnt);
    expect(state.score).toBe(0);
    catchWisp(state, burnt);
    expect(state.score).toBe(0);
  });

  it('catches a wisp that drifts into the cone', () => {
    const state = createState();
    state.nextSpawn = 10;
    state.coneX = 400;
    state.wisps = [{ ...pink, y: CONE_Y - 5, vy: 100 }];
    step(state, 0.05);
    expect(state.score).toBe(PINK_GRAMS);
    expect(state.wisps).toHaveLength(0);
  });

  it('lets a wisp past when the cone is elsewhere', () => {
    const state = createState();
    state.nextSpawn = 10;
    state.coneX = 400 + CONE_HALF_WIDTH * 3;
    state.wisps = [{ ...pink, y: CONE_Y - 5, vy: 100 }];
    step(state, 0.05);
    expect(state.score).toBe(0);
    expect(state.wisps).toHaveLength(1);
  });

  it('ends the round at 30 seconds and clears the wisps', () => {
    const state = createState();
    step(state, ROUND_SECONDS - 0.01, always(0.5));
    expect(state.phase).toBe('playing');
    step(state, 0.01, always(0.5));
    expect(state.phase).toBe('over');
    expect(timeLeft(state)).toBe(0);
    expect(state.wisps).toHaveLength(0);
  });

  it('keeps the score once the round is over', () => {
    const state = createState();
    state.score = 70;
    step(state, ROUND_SECONDS);
    step(state, 1);
    expect(state.score).toBe(70);
    expect(state.phase).toBe('over');
  });

  it('spawns wisps deterministically from the random function', () => {
    const a = createState();
    const b = createState();
    spawnWisp(a, always(0.1));
    spawnWisp(b, always(0.1));
    expect(a.wisps).toEqual(b.wisps);
    expect(a.wisps[0].kind).toBe('burnt');
    expect(spawnWisp(a, always(BURNT_CHANCE)).kind).toBe('pink');
  });

  it('sends wisps faster as the round goes on', () => {
    expect(spawnInterval(ROUND_SECONDS)).toBeLessThan(spawnInterval(0));
  });

  it('keeps the cone inside the booth', () => {
    const state = createState();
    moveCone(state, -100);
    expect(state.coneX).toBe(CONE_HALF_WIDTH);
  });

  it('grows the floss on the cone as the score goes up', () => {
    expect(flossRadius(0)).toBe(0);
    expect(flossRadius(100)).toBeGreaterThan(flossRadius(10));
  });
});
