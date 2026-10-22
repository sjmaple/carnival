import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

export const ROUND_SECONDS = 30;
export const PINK_GRAMS = 10;
export const BURNT_GRAMS = 25;
/** The chance that a new wisp is burnt. */
export const BURNT_CHANCE = 0.2;
/** Seconds between wisps at the start and at the end of a round. */
export const SPAWN_INTERVAL = { start: 0.9, end: 0.35 } as const;
export const CONE = { y: HEIGHT - 70, halfWidth: 40, speed: 480 } as const;
const DRUM = { x: WIDTH / 2, y: 150, radius: 110 } as const;
const WISP_RADIUS = 14;
const FALL_SPEED = { min: 90, max: 150 };
const DRIFT_SPEED = 160;

export type WispKind = 'pink' | 'burnt';

export interface Wisp {
  x: number;
  y: number;
  /** Pixels per second; negative drifts left. */
  vx: number;
  vy: number;
  kind: WispKind;
}

export interface CandyFlossState {
  wisps: Wisp[];
  /** The centre of the cone's mouth. */
  coneX: number;
  /** Grams of floss on the cone. */
  score: number;
  /** Seconds since the round began. */
  elapsed: number;
  /** Seconds until the next wisp leaves the drum. */
  nextSpawn: number;
  phase: 'playing' | 'over';
}

export function createState(): CandyFlossState {
  return {
    wisps: [],
    coneX: WIDTH / 2,
    score: 0,
    elapsed: 0,
    nextSpawn: SPAWN_INTERVAL.start,
    phase: 'playing',
  };
}

export function timeLeft(state: CandyFlossState): number {
  return Math.max(ROUND_SECONDS - state.elapsed, 0);
}

/** Wisps come faster as the round goes on. */
export function spawnInterval(elapsed: number): number {
  const progress = Math.min(Math.max(elapsed / ROUND_SECONDS, 0), 1);
  return SPAWN_INTERVAL.start + (SPAWN_INTERVAL.end - SPAWN_INTERVAL.start) * progress;
}

/** Spins one wisp out of the drum. `random` returns numbers in [0, 1). */
export function spawnWisp(state: CandyFlossState, random: () => number): Wisp {
  const angle = random() * Math.PI * 2;
  const wisp: Wisp = {
    x: DRUM.x + Math.cos(angle) * DRUM.radius,
    y: DRUM.y + Math.sin(angle) * DRUM.radius * 0.5,
    vx: (random() * 2 - 1) * DRIFT_SPEED,
    vy: FALL_SPEED.min + random() * (FALL_SPEED.max - FALL_SPEED.min),
    kind: random() < BURNT_CHANCE ? 'burnt' : 'pink',
  };
  state.wisps.push(wisp);
  return wisp;
}

/** Puts the cone under `x`, kept inside the booth. */
export function moveCone(state: CandyFlossState, x: number): void {
  state.coneX = Math.min(Math.max(x, CONE.halfWidth), WIDTH - CONE.halfWidth);
}

/** Slides the cone for `dt` seconds: -1 is left, 1 is right. */
export function nudgeCone(state: CandyFlossState, direction: -1 | 0 | 1, dt: number): void {
  moveCone(state, state.coneX + direction * CONE.speed * dt);
}

export function isCaught(wisp: Wisp, coneX: number): boolean {
  return Math.abs(wisp.x - coneX) <= CONE.halfWidth && Math.abs(wisp.y - CONE.y) <= WISP_RADIUS;
}

/** Adds a caught wisp to the cone. A burnt wisp never takes the cone below 0 grams. */
export function catchWisp(state: CandyFlossState, wisp: Wisp): void {
  state.score =
    wisp.kind === 'pink' ? state.score + PINK_GRAMS : Math.max(state.score - BURNT_GRAMS, 0);
}

/** Advances the round by `dt` seconds. */
export function step(state: CandyFlossState, dt: number, random: () => number = Math.random): void {
  if (state.phase !== 'playing') return;

  state.elapsed = Math.min(state.elapsed + dt, ROUND_SECONDS);

  state.nextSpawn -= dt;
  while (state.nextSpawn <= 0) {
    spawnWisp(state, random);
    state.nextSpawn += spawnInterval(state.elapsed);
  }

  const remaining: Wisp[] = [];
  for (const wisp of state.wisps) {
    wisp.x += wisp.vx * dt;
    wisp.y += wisp.vy * dt;
    // Bounce off the booth's sides so wisps stay in reach a little longer.
    if (wisp.x < WISP_RADIUS || wisp.x > WIDTH - WISP_RADIUS) wisp.vx = -wisp.vx;
    if (isCaught(wisp, state.coneX)) {
      catchWisp(state, wisp);
    } else if (wisp.y < HEIGHT + WISP_RADIUS) {
      remaining.push(wisp);
    }
  }
  state.wisps = remaining;

  if (state.elapsed >= ROUND_SECONDS) {
    state.phase = 'over';
    state.wisps = [];
  }
}

/** The radius of the floss on the cone, which grows with the score. */
export function flossRadius(score: number): number {
  return Math.min(16 + Math.sqrt(score) * 3, 90);
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
  ctx.ellipse(DRUM.x, DRUM.y, DRUM.radius + 20, (DRUM.radius + 20) * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = colors.muted;
  ctx.lineWidth = 2;
  const spin = state.elapsed * 6;
  for (let i = 0; i < 6; i++) {
    const angle = spin + (i * Math.PI) / 3;
    ctx.beginPath();
    ctx.moveTo(DRUM.x, DRUM.y);
    ctx.lineTo(
      DRUM.x + Math.cos(angle) * DRUM.radius,
      DRUM.y + Math.sin(angle) * DRUM.radius * 0.5,
    );
    ctx.stroke();
  }

  // Theme has no pink, so pink wisps use the closest colour, `danger`.
  for (const wisp of state.wisps) {
    ctx.fillStyle = wisp.kind === 'pink' ? colors.danger : colors.wood;
    ctx.beginPath();
    ctx.arc(wisp.x, wisp.y, WISP_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  }

  // The paper cone, with its floss growing as the score goes up.
  const floss = flossRadius(state.score);
  ctx.fillStyle = colors.danger;
  ctx.beginPath();
  ctx.arc(state.coneX, CONE.y - floss * 0.4, floss, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colors.stripeB;
  ctx.beginPath();
  ctx.moveTo(state.coneX - CONE.halfWidth, CONE.y);
  ctx.lineTo(state.coneX + CONE.halfWidth, CONE.y);
  ctx.lineTo(state.coneX, HEIGHT - 5);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'left';
  ctx.fillText(`Floss: ${state.score} g`, 16, 70);
  ctx.textAlign = 'right';
  ctx.fillText(`Time: ${Math.ceil(timeLeft(state))}`, WIDTH - 16, 70);

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
  description: 'Catch the pink wisps in your cone and dodge the burnt ones before time runs out.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    let state = createState();
    let scoreRecorded = false;
    const keys = { left: false, right: false };

    const onMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      moveCone(state, ((event.clientX - rect.left) / rect.width) * WIDTH);
    };
    const onDown = () => {
      if (state.phase === 'over') {
        state = createState();
        scoreRecorded = false;
      }
    };
    const onKey = (event: KeyboardEvent) => {
      const down = event.type === 'keydown';
      if (event.key === 'ArrowLeft') keys.left = down;
      else if (event.key === 'ArrowRight') keys.right = down;
      else return;
      event.preventDefault();
    };
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);

    let frame = 0;
    let last = performance.now();
    const loop = (time: number) => {
      // Cap the step so a background tab doesn't teleport everything.
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      nudgeCone(state, ((keys.right ? 1 : 0) - (keys.left ? 1 : 0)) as -1 | 0 | 1, dt);
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
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
    };
  },
};
