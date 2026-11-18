import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

// The world is measured in metres: x across the stall and z away from the
// player.
export const RINGS_PER_ROUND = 10;
export const BOTTLE_COLUMNS = 5;
export const BOTTLE_SPACING = 0.7;
/** How far each row of bottles stands from the throwing line, nearest first. */
export const ROW_DEPTHS = [3, 4, 5] as const;
/** Points for ringing a bottle in each row. Bottles further back score more. */
export const ROW_POINTS = [10, 20, 30] as const;
/** A ring that lands this close to a bottle's centre drops over its neck. */
export const NECK_RADIUS = 0.12;
/** How far a throw can stray per metre of distance. Far bottles are harder. */
export const SCATTER_PER_METRE = 0.03;
export const NEAR_LIMIT = 2;
export const FAR_LIMIT = 6;
export const AIM_LIMIT = 2.5;
/** Metres per second the aim moves while an arrow key is held. */
export const AIM_SPEED = 2.5;
/** Seconds a ring spends in the air. */
export const FLIGHT_TIME = 0.5;

export interface Bottle {
  x: number;
  z: number;
  row: number;
  ringed: boolean;
}

export interface Ring {
  /** Where the ring lands, scatter included. */
  x: number;
  z: number;
  /** Seconds since the throw. */
  t: number;
}

export type Outcome =
  | { kind: 'miss' }
  | { kind: 'taken'; bottle: number }
  | { kind: 'ringer'; bottle: number; points: number };

export interface RingTossState {
  bottles: Bottle[];
  ring: Ring | null;
  /** Where the next ring is aimed. */
  aimX: number;
  aimZ: number;
  rings: number;
  score: number;
  /** What the last throw did, for the status line. */
  last: Outcome | null;
  phase: 'playing' | 'over';
}

export function createState(): RingTossState {
  const bottles: Bottle[] = [];
  for (const [row, z] of ROW_DEPTHS.entries()) {
    for (let i = 0; i < BOTTLE_COLUMNS; i++) {
      bottles.push({ x: (i - (BOTTLE_COLUMNS - 1) / 2) * BOTTLE_SPACING, z, row, ringed: false });
    }
  }
  return {
    bottles,
    ring: null,
    aimX: 0,
    aimZ: ROW_DEPTHS[1],
    rings: RINGS_PER_ROUND,
    score: 0,
    last: null,
    phase: 'playing',
  };
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function setAim(state: RingTossState, x: number, z: number): void {
  state.aimX = clamp(x, -AIM_LIMIT, AIM_LIMIT);
  state.aimZ = clamp(z, NEAR_LIMIT, FAR_LIMIT);
}

/** Moves the aim by `dx` across and `dz` away, for `dt` seconds. Each is -1, 0 or +1. */
export function nudgeAim(state: RingTossState, dx: number, dz: number, dt: number): void {
  setAim(state, state.aimX + dx * AIM_SPEED * dt, state.aimZ + dz * AIM_SPEED * dt);
}

/** Where a ring thrown at the aim lands. A `random` of 0.5 lands it dead on. */
export function landingSpot(aimX: number, aimZ: number, random: () => number) {
  const scatter = SCATTER_PER_METRE * aimZ;
  return {
    x: aimX + (random() - 0.5) * 2 * scatter,
    z: aimZ + (random() - 0.5) * 2 * scatter,
  };
}

/** Works out what a ring landing at (x, z) does: ring a bottle, land on a ringed one, or miss. */
export function resolveThrow(x: number, z: number, bottles: readonly Bottle[]): Outcome {
  let best: { bottle: number; distance: number } | null = null;
  for (const [i, bottle] of bottles.entries()) {
    const distance = Math.hypot(x - bottle.x, z - bottle.z);
    if (distance <= NECK_RADIUS && (!best || distance < best.distance))
      best = { bottle: i, distance };
  }
  if (!best) return { kind: 'miss' };
  const bottle = bottles[best.bottle];
  if (bottle.ringed) return { kind: 'taken', bottle: best.bottle };
  return { kind: 'ringer', bottle: best.bottle, points: ROW_POINTS[bottle.row] };
}

/**
 * Throws a ring at the aim. Returns false if nothing was thrown: the round is
 * over, no rings are left, or a ring is still in the air.
 */
export function throwRing(state: RingTossState, random: () => number = Math.random): boolean {
  if (state.phase !== 'playing' || state.rings === 0 || state.ring) return false;
  state.ring = { ...landingSpot(state.aimX, state.aimZ, random), t: 0 };
  state.rings -= 1;
  return true;
}

/** Applies a throw's outcome to the bottles and the score. */
export function applyOutcome(state: RingTossState, outcome: Outcome): void {
  state.last = outcome;
  if (outcome.kind !== 'ringer') return;
  state.bottles[outcome.bottle].ringed = true;
  state.score += outcome.points;
}

/** Advances the game by `dt` seconds. */
export function step(state: RingTossState, dt: number): void {
  if (state.ring) {
    state.ring.t += dt;
    if (state.ring.t >= FLIGHT_TIME) {
      applyOutcome(state, resolveThrow(state.ring.x, state.ring.z, state.bottles));
      state.ring = null;
    }
  }
  if (state.phase === 'playing' && !state.ring && state.rings === 0) state.phase = 'over';
}

// Drawing: a simple perspective from just behind the throwing line.
const CAMERA_BACK = 1;
const CAMERA_HEIGHT = 1.2;
const FOCAL = 500;
const HORIZON = 150;
const BOTTLE_HEIGHT = 0.3;

function project(x: number, z: number, h = 0) {
  const scale = FOCAL / (z + CAMERA_BACK);
  return { x: WIDTH / 2 + x * scale, y: HORIZON + (CAMERA_HEIGHT - h) * scale, scale };
}

/** The aim on the ground for a pointer at canvas (x, y). */
export function aimForCanvas(canvasX: number, canvasY: number) {
  const scale = Math.max(1, canvasY - HORIZON) / CAMERA_HEIGHT;
  return { x: (canvasX - WIDTH / 2) / scale, z: FOCAL / scale - CAMERA_BACK };
}

function outcomeText(outcome: Outcome): string {
  if (outcome.kind === 'ringer') return `Ringer! +${outcome.points}`;
  return outcome.kind === 'taken' ? 'Already ringed!' : 'Missed!';
}

function drawRing(ctx: CanvasRenderingContext2D, x: number, z: number, h: number) {
  const p = project(x, z, h);
  const r = Math.max(4, NECK_RADIUS * 1.6 * p.scale);
  ctx.strokeStyle = theme.colors.accent;
  ctx.lineWidth = Math.max(2, r * 0.25);
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, r, r * 0.4, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function draw(ctx: CanvasRenderingContext2D, state: RingTossState) {
  const { colors } = theme;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Back cloth and the floor of the stall.
  ctx.fillStyle = colors.surface;
  ctx.fillRect(0, 40, WIDTH, HEIGHT - 110);

  // Booth awning.
  const stripe = WIDTH / 16;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? colors.stripeA : colors.stripeB;
    ctx.fillRect(i * stripe, 0, stripe, 40);
  }

  // Bottles, back row first so nearer ones draw over them.
  for (const bottle of [...state.bottles].sort((a, b) => b.z - a.z)) {
    const base = project(bottle.x, bottle.z);
    const neck = project(bottle.x, bottle.z, BOTTLE_HEIGHT);
    const w = 0.07 * base.scale;
    ctx.fillStyle = colors.water;
    ctx.fillRect(
      base.x - w * 1.5,
      neck.y + (base.y - neck.y) * 0.4,
      w * 3,
      (base.y - neck.y) * 0.6,
    );
    ctx.fillRect(base.x - w * 0.6, neck.y, w * 1.2, (base.y - neck.y) * 0.5);
    if (bottle.ringed) drawRing(ctx, bottle.x, bottle.z, BOTTLE_HEIGHT * 0.7);
  }

  // The counter at the front.
  ctx.fillStyle = colors.wood;
  ctx.fillRect(0, HEIGHT - 70, WIDTH, 70);

  // Aim marker on the ground.
  if (state.phase === 'playing') {
    const aim = project(state.aimX, state.aimZ);
    ctx.strokeStyle = colors.muted;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(
      aim.x,
      aim.y,
      NECK_RADIUS * aim.scale * 1.6,
      NECK_RADIUS * aim.scale * 0.6,
      0,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
  }

  // The ring in the air, arcing from the player to where it lands.
  if (state.ring) {
    const f = state.ring.t / FLIGHT_TIME;
    const lift = Math.sin(Math.PI * f) * 1.2;
    drawRing(ctx, state.ring.x * f, state.ring.z * f, lift + 0.2 * (1 - f));
  }

  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'left';
  ctx.fillText(`Score ${state.score}`, 16, HEIGHT - 20);
  ctx.textAlign = 'right';
  ctx.fillText(`Rings ${state.rings}/${RINGS_PER_ROUND}`, WIDTH - 16, HEIGHT - 20);
  if (state.last) {
    ctx.textAlign = 'center';
    ctx.fillText(outcomeText(state.last), WIDTH / 2, HEIGHT - 20);
  }

  if (state.phase === 'over') {
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.fillText(`Out of rings! You scored ${state.score}`, WIDTH / 2, HEIGHT / 2);
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body');
    ctx.fillText('Click or press Space to play again', WIDTH / 2, HEIGHT / 2 + 40);
  }
}

export const ringToss: CarnivalGame = {
  id: 'ring-toss',
  name: 'Ring Toss',
  description:
    'Ten rings, fifteen bottles. Aim and throw: the further back the bottle, the more it scores.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    let state = createState();
    let scoreRecorded = false;
    const held = { left: false, right: false, up: false, down: false };

    const throwOrRestart = () => {
      if (state.phase === 'over') {
        state = createState();
        scoreRecorded = false;
      } else {
        throwRing(state);
      }
    };

    const toAim = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const aim = aimForCanvas(
        ((event.clientX - rect.left) / rect.width) * WIDTH,
        ((event.clientY - rect.top) / rect.height) * HEIGHT,
      );
      setAim(state, aim.x, aim.z);
    };
    const onMove = (event: PointerEvent) => toAim(event);
    const onDown = (event: PointerEvent) => {
      toAim(event);
      throwOrRestart();
    };
    const keyToHeld = (key: string): keyof typeof held | null => {
      if (key === 'ArrowLeft') return 'left';
      if (key === 'ArrowRight') return 'right';
      if (key === 'ArrowUp') return 'up';
      if (key === 'ArrowDown') return 'down';
      return null;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const direction = keyToHeld(event.key);
      if (direction) held[direction] = true;
      else if (event.key === ' ') {
        if (!event.repeat) throwOrRestart();
      } else return;
      event.preventDefault();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      const direction = keyToHeld(event.key);
      if (direction) held[direction] = false;
    };
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    let frame = 0;
    let last = performance.now();
    const loop = (time: number) => {
      // Cap the step so a background tab doesn't teleport everything.
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      nudgeAim(
        state,
        Number(held.right) - Number(held.left),
        Number(held.up) - Number(held.down),
        dt,
      );
      step(state, dt);
      if (state.phase === 'over' && !scoreRecorded) {
        recordScore(ringToss.id, state.score);
        scoreRecorded = true;
      }
      draw(ctx, state);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  },
};
