import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

export const ROUND_SECONDS = 30;
export const PINK_GRAMS = 10;
export const BURNT_GRAMS = 25;
/** Chance that a new wisp is burnt. */
export const BURNT_CHANCE = 0.2;
/** Seconds between wisps at the start of the round, and at the end. */
export const SPAWN_START = 0.8;
export const SPAWN_END = 0.35;
export const CONE_Y = HEIGHT - 70;
export const CONE_HALF_WIDTH = 34;
/** How fast the arrow keys move the cone, in pixels per second. */
export const CONE_SPEED = 420;
export const DRUM = { x: WIDTH / 2, y: 150, radius: 110 } as const;
const WISP_RADIUS = 12;

export type Random = () => number;

export interface Wisp {
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: 'pink' | 'burnt';
}

export interface CandyFlossState {
  /** The centre of the cone's mouth. */
  coneX: number;
  wisps: Wisp[];
  /** Grams of floss on the cone. */
  score: number;
  /** Seconds since the round started. */
  time: number;
  /** Seconds until the next wisp leaves the drum. */
  nextSpawn: number;
  phase: 'playing' | 'over';
}

export function createState(): CandyFlossState {
  return {
    coneX: WIDTH / 2,
    wisps: [],
    score: 0,
    time: 0,
    nextSpawn: SPAWN_START,
    phase: 'playing',
  };
}

export function timeLeft(state: CandyFlossState): number {
  return Math.max(0, ROUND_SECONDS - state.time);
}

/** Wisps come faster as the round goes on. */
export function spawnInterval(time: number): number {
  const progress = Math.min(Math.max(time / ROUND_SECONDS, 0), 1);
  return SPAWN_START + (SPAWN_END - SPAWN_START) * progress;
}

/** Sends one wisp out of the drum, drifting down and to the side. */
export function spawnWisp(state: CandyFlossState, random: Random): Wisp {
  const angle = random() * Math.PI * 2;
  const wisp: Wisp = {
    x: DRUM.x + Math.cos(angle) * DRUM.radius * 0.6,
    y: DRUM.y + Math.sin(angle) * DRUM.radius * 0.6,
    vx: (random() - 0.5) * 320,
    vy: 90 + random() * 90,
    kind: random() < BURNT_CHANCE ? 'burnt' : 'pink',
  };
  state.wisps.push(wisp);
  return wisp;
}

/** Puts the cone at `x`, kept inside the booth. */
export function moveCone(state: CandyFlossState, x: number): void {
  if (state.phase !== 'playing') return;
  state.coneX = Math.min(Math.max(x, CONE_HALF_WIDTH), WIDTH - CONE_HALF_WIDTH);
}

export function isCaught(wisp: Wisp, coneX: number): boolean {
  return (
    wisp.y >= CONE_Y - WISP_RADIUS &&
    wisp.y <= CONE_Y + WISP_RADIUS &&
    Math.abs(wisp.x - coneX) <= CONE_HALF_WIDTH
  );
}

/** Adds or takes away floss for a caught wisp. The score never drops below 0. */
export function catchWisp(state: CandyFlossState, wisp: Wisp): void {
  const grams = wisp.kind === 'pink' ? PINK_GRAMS : -BURNT_GRAMS;
  state.score = Math.max(0, state.score + grams);
}

/** The radius of the floss on the cone, which grows with the score. */
export function flossRadius(score: number): number {
  return score === 0 ? 0 : 14 + Math.sqrt(score) * 2.5;
}

/** Advances the round by `dt` seconds. */
export function step(state: CandyFlossState, dt: number, random: Random = Math.random): void {
  if (state.phase !== 'playing') return;

  state.time += dt;
  if (state.time >= ROUND_SECONDS) {
    state.time = ROUND_SECONDS;
    state.wisps = [];
    state.phase = 'over';
    return;
  }

  state.nextSpawn -= dt;
  while (state.nextSpawn <= 0) {
    spawnWisp(state, random);
    state.nextSpawn += spawnInterval(state.time);
  }

  const remaining: Wisp[] = [];
  for (const wisp of state.wisps) {
    wisp.x += wisp.vx * dt;
    wisp.y += wisp.vy * dt;
    if (wisp.x < WISP_RADIUS || wisp.x > WIDTH - WISP_RADIUS) {
      wisp.vx = -wisp.vx;
      wisp.x = Math.min(Math.max(wisp.x, WISP_RADIUS), WIDTH - WISP_RADIUS);
    }
    if (isCaught(wisp, state.coneX)) {
      catchWisp(state, wisp);
    } else if (wisp.y < HEIGHT + WISP_RADIUS) {
      remaining.push(wisp);
    }
  }
  state.wisps = remaining;
}

function draw(ctx: CanvasRenderingContext2D, state: CandyFlossState) {
  const { colors } = theme;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Booth awning.
  const stripe = WIDTH / 16;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? colors.stripeA : colors.stripeB;
    ctx.fillRect(i * stripe, 0, stripe, 40);
  }

  // The spinning drum.
  ctx.fillStyle = colors.surface;
  ctx.beginPath();
  ctx.arc(DRUM.x, DRUM.y, DRUM.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = colors.muted;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const angle = state.time * 4 + (i * Math.PI) / 3;
    ctx.beginPath();
    ctx.moveTo(DRUM.x, DRUM.y);
    ctx.lineTo(
      DRUM.x + Math.cos(angle) * DRUM.radius * 0.4,
      DRUM.y + Math.sin(angle) * DRUM.radius * 0.4,
    );
    ctx.stroke();
  }

  for (const wisp of state.wisps) {
    ctx.fillStyle = wisp.kind === 'pink' ? colors.danger : colors.wood;
    for (const [dx, dy] of [
      [-6, 0],
      [6, 0],
      [0, -5],
    ]) {
      ctx.beginPath();
      ctx.arc(wisp.x + dx, wisp.y + dy, WISP_RADIUS * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // The floss on the cone, then the paper cone.
  const radius = flossRadius(state.score);
  if (radius > 0) {
    ctx.fillStyle = colors.danger;
    ctx.beginPath();
    ctx.arc(state.coneX, CONE_Y - radius * 0.6, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = colors.stripeB;
  ctx.beginPath();
  ctx.moveTo(state.coneX - CONE_HALF_WIDTH, CONE_Y);
  ctx.lineTo(state.coneX + CONE_HALF_WIDTH, CONE_Y);
  ctx.lineTo(state.coneX, HEIGHT - 10);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'left';
  ctx.fillText(`Floss ${state.score} g`, 16, HEIGHT - 20);
  ctx.textAlign = 'right';
  ctx.fillText(`Time ${Math.ceil(timeLeft(state))}s`, WIDTH - 16, HEIGHT - 20);

  if (state.phase === 'over') {
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.fillText(`Time's up! ${state.score} grams of floss`, WIDTH / 2, HEIGHT / 2);
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body');
    ctx.fillText('Click to play again', WIDTH / 2, HEIGHT / 2 + 40);
  }
}

export const candyFloss: CarnivalGame = {
  id: 'candy-floss',
  name: 'Candy Floss',
  description: 'Catch the pink wisps from the spinning drum, and dodge the burnt ones.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    let state = createState();
    let scoreRecorded = false;
    const keys = { left: false, right: false };

    const toCanvasX = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return ((event.clientX - rect.left) / rect.width) * WIDTH;
    };
    const onMove = (event: PointerEvent) => moveCone(state, toCanvasX(event));
    const onDown = (event: PointerEvent) => {
      if (state.phase === 'over') {
        state = createState();
        scoreRecorded = false;
      }
      moveCone(state, toCanvasX(event));
    };
    const setKey = (event: KeyboardEvent, down: boolean) => {
      if (event.key === 'ArrowLeft') keys.left = down;
      else if (event.key === 'ArrowRight') keys.right = down;
      else return;
      event.preventDefault();
    };
    const onKeyDown = (event: KeyboardEvent) => setKey(event, true);
    const onKeyUp = (event: KeyboardEvent) => setKey(event, false);
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
      const direction = Number(keys.right) - Number(keys.left);
      if (direction !== 0) moveCone(state, state.coneX + direction * CONE_SPEED * dt);
      step(state, dt);
      if (state.phase === 'over' && !scoreRecorded) {
        recordScore(candyFloss.id, state.score);
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
