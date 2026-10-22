import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

// The world is measured in metres: x across the stall, z away from the
// player and h up from the ground.
export const BALLS_PER_ROUND = 6;
export const COCONUT_COUNT = 5;
export const COCONUT_SPACING = 0.8;
export const COCONUT_RADIUS = 0.18;
export const BALL_RADIUS = 0.05;
/** How far the posts stand from the throwing line. */
export const SHELF_DEPTH = 6;
export const POST_HEIGHT = 1.2;
export const LAUNCH_HEIGHT = 1;
export const LAUNCH_ANGLE = (20 * Math.PI) / 180;
export const MIN_SPEED = 7;
export const MAX_SPEED = 13;
export const GRAVITY = 9.8;
/** Seconds of holding to charge from no power to full power. */
export const CHARGE_TIME = 1.5;
/** Metres per second the aim moves while an arrow key is held. */
export const AIM_SPEED = 2.5;
export const AIM_LIMIT = 2.5;
/** A hit knocks a coconut off when its speed times its centrality reaches this. */
export const KNOCK_IMPULSE = 5;

export const POINTS = { knock: 100, wobble: 10, clearBonus: 200, ballLeft: 50 } as const;

export interface Coconut {
  x: number;
  down: boolean;
  /** Seconds since it was knocked off; drives the fall. */
  fallen: number;
  /** How far it is rocking, in radians; dies away over time. */
  wobble: number;
  wobbleTime: number;
}

export interface Ball {
  aimX: number;
  speed: number;
  /** Seconds since the throw. */
  t: number;
}

export type Outcome =
  | { kind: 'short'; time: number }
  | { kind: 'over'; time: number }
  | { kind: 'wide'; time: number }
  | { kind: 'knock' | 'wobble'; time: number; coconut: number; impulse: number };

export interface CoconutShyState {
  coconuts: Coconut[];
  ball: Ball | null;
  /** Where the ball is aimed, across the stall. */
  aimX: number;
  /** From 0 to 1 while charging. */
  power: number;
  charging: boolean;
  balls: number;
  score: number;
  /** What the last throw did, for the status line. */
  last: Outcome['kind'] | null;
  phase: 'playing' | 'over';
}

export function createState(): CoconutShyState {
  const coconuts = Array.from({ length: COCONUT_COUNT }, (_, i) => ({
    x: (i - (COCONUT_COUNT - 1) / 2) * COCONUT_SPACING,
    down: false,
    fallen: 0,
    wobble: 0,
    wobbleTime: 0,
  }));
  return {
    coconuts,
    ball: null,
    aimX: 0,
    power: 0,
    charging: false,
    balls: BALLS_PER_ROUND,
    score: 0,
    last: null,
    phase: 'playing',
  };
}

export function setAim(state: CoconutShyState, x: number): void {
  state.aimX = Math.max(-AIM_LIMIT, Math.min(AIM_LIMIT, x));
}

/** Moves the aim left (-1) or right (+1) for `dt` seconds. */
export function nudgeAim(state: CoconutShyState, direction: -1 | 1, dt: number): void {
  setAim(state, state.aimX + direction * AIM_SPEED * dt);
}

export function startCharge(state: CoconutShyState): void {
  if (state.phase !== 'playing' || state.balls === 0 || state.ball) return;
  state.charging = true;
  state.power = 0;
}

export function speedForPower(power: number): number {
  return MIN_SPEED + Math.max(0, Math.min(1, power)) * (MAX_SPEED - MIN_SPEED);
}

/** Where a ball is `t` seconds after it was thrown. */
export function ballPosition(ball: Ball, t: number = ball.t) {
  const forward = ball.speed * Math.cos(LAUNCH_ANGLE);
  const up = ball.speed * Math.sin(LAUNCH_ANGLE);
  return { x: ball.aimX, z: forward * t, h: LAUNCH_HEIGHT + up * t - (GRAVITY * t * t) / 2 };
}

/** Works out what a ball will do: land short, sail over, go wide, or hit a coconut. */
export function resolveThrow(ball: Ball, coconuts: readonly Coconut[]): Outcome {
  const forward = ball.speed * Math.cos(LAUNCH_ANGLE);
  const up = ball.speed * Math.sin(LAUNCH_ANGLE);
  const landTime = (up + Math.sqrt(up * up + 2 * GRAVITY * LAUNCH_HEIGHT)) / GRAVITY;
  const time = SHELF_DEPTH / forward;
  if (landTime <= time) return { kind: 'short', time: landTime };

  const { h } = ballPosition(ball, time);
  const centre = POST_HEIGHT + COCONUT_RADIUS;
  const reach = COCONUT_RADIUS + BALL_RADIUS;
  if (h < centre - reach) return { kind: 'short', time };
  if (h > centre + reach) return { kind: 'over', time };

  let best: { coconut: number; distance: number } | null = null;
  for (const [i, coconut] of coconuts.entries()) {
    if (coconut.down) continue;
    const distance = Math.hypot(ball.aimX - coconut.x, h - centre);
    if (distance <= reach && (!best || distance < best.distance)) best = { coconut: i, distance };
  }
  if (!best) return { kind: 'wide', time };

  const { coconut, distance } = best;
  const speed = Math.hypot(forward, up - GRAVITY * time);
  const impulse = speed * (1 - distance / reach);
  return { kind: impulse >= KNOCK_IMPULSE ? 'knock' : 'wobble', time, coconut, impulse };
}

/**
 * Throws a ball with the charged power. Returns false if nothing was thrown:
 * the round is over, no balls are left, or a ball is still in the air.
 */
export function throwBall(state: CoconutShyState): boolean {
  if (state.phase !== 'playing' || state.balls === 0 || state.ball) return false;
  state.ball = { aimX: state.aimX, speed: speedForPower(state.power), t: 0 };
  state.balls -= 1;
  state.charging = false;
  state.power = 0;
  return true;
}

/** Applies a throw's outcome to the coconuts and the score. */
export function applyOutcome(
  state: CoconutShyState,
  outcome: Outcome,
  random: () => number = Math.random,
): void {
  state.last = outcome.kind;
  if (outcome.kind !== 'knock' && outcome.kind !== 'wobble') return;
  const coconut = state.coconuts[outcome.coconut];
  if (outcome.kind === 'knock') {
    coconut.down = true;
    state.score += POINTS.knock;
  } else {
    coconut.wobble = 0.15 + random() * 0.25;
    coconut.wobbleTime = 0;
    state.score += POINTS.wobble;
  }
}

/** Ends the round, adding the bonus if every coconut is down. */
export function finishRound(state: CoconutShyState): void {
  if (state.phase === 'over') return;
  if (state.coconuts.every((c) => c.down)) {
    state.score += POINTS.clearBonus + POINTS.ballLeft * state.balls;
  }
  state.charging = false;
  state.phase = 'over';
}

/** Advances the game by `dt` seconds. */
export function step(state: CoconutShyState, dt: number, random: () => number = Math.random): void {
  if (state.charging) state.power = Math.min(1, state.power + dt / CHARGE_TIME);

  for (const coconut of state.coconuts) {
    if (coconut.down) coconut.fallen += dt;
    coconut.wobbleTime += dt;
    coconut.wobble *= Math.exp(-2 * dt);
  }

  if (state.ball) {
    state.ball.t += dt;
    const outcome = resolveThrow(state.ball, state.coconuts);
    if (state.ball.t >= outcome.time) {
      applyOutcome(state, outcome, random);
      state.ball = null;
    }
  }

  const cleared = state.coconuts.every((c) => c.down);
  if (state.phase === 'playing' && !state.ball && (cleared || state.balls === 0)) {
    finishRound(state);
  }
}

// Drawing: a simple perspective from just behind the throwing line.
const CAMERA_BACK = 2;
const CAMERA_HEIGHT = 1.4;
const FOCAL = 960;
const HORIZON = 230;

function project(x: number, z: number, h: number) {
  const scale = FOCAL / (z + CAMERA_BACK);
  return { x: WIDTH / 2 + x * scale, y: HORIZON - (h - CAMERA_HEIGHT) * scale, scale };
}

/** The aim across the stall for a pointer at canvas x, lined up with the posts. */
export function aimForCanvasX(canvasX: number): number {
  return (canvasX - WIDTH / 2) / project(0, SHELF_DEPTH, 0).scale;
}

const OUTCOME_TEXT: Record<Outcome['kind'], string> = {
  short: 'Too short!',
  over: 'Over the top!',
  wide: 'Missed!',
  wobble: 'Wobble! +10',
  knock: 'Knocked off! +100',
};

function draw(ctx: CanvasRenderingContext2D, state: CoconutShyState) {
  const { colors } = theme;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Back cloth and the floor of the stall.
  const floor = project(0, SHELF_DEPTH, 0).y;
  ctx.fillStyle = colors.surface;
  ctx.fillRect(0, 40, WIDTH, floor - 40);

  // Booth awning.
  const stripe = WIDTH / 16;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? colors.stripeA : colors.stripeB;
    ctx.fillRect(i * stripe, 0, stripe, 40);
  }

  // Posts and coconuts. The theme has no coconut brown, so coconuts use wood.
  for (const coconut of state.coconuts) {
    const base = project(coconut.x, SHELF_DEPTH, 0);
    const top = project(coconut.x, SHELF_DEPTH, POST_HEIGHT);
    ctx.fillStyle = colors.muted;
    ctx.fillRect(top.x - 5, top.y, 10, base.y - top.y);
    ctx.fillRect(top.x - 18, top.y - 4, 36, 6);

    if (coconut.down && coconut.fallen > 0.5) continue;
    const r = COCONUT_RADIUS * top.scale;
    const drop = coconut.down ? coconut.fallen * coconut.fallen * 600 : 0;
    const tilt = coconut.down
      ? coconut.fallen * 4
      : Math.sin(coconut.wobbleTime * 18) * coconut.wobble;
    ctx.save();
    ctx.translate(top.x, top.y - 4);
    ctx.rotate(tilt);
    ctx.translate(0, drop);
    ctx.fillStyle = colors.wood;
    ctx.beginPath();
    ctx.arc(0, -r, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colors.background;
    for (const dx of [-0.3, 0, 0.3]) {
      ctx.beginPath();
      ctx.arc(dx * r, -r * 1.4, r * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // The counter at the front.
  ctx.fillStyle = colors.wood;
  ctx.fillRect(0, HEIGHT - 70, WIDTH, 70);

  // Aim marker at the posts.
  const aim = project(state.aimX, SHELF_DEPTH, POST_HEIGHT + COCONUT_RADIUS);
  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(aim.x, aim.y - 40);
  ctx.lineTo(aim.x, aim.y + 40);
  ctx.stroke();

  // The ball. Wooden balls are drawn in the theme's cream so they stand out
  // from the coconuts.
  if (state.ball) {
    const pos = ballPosition(state.ball);
    const p = project(pos.x, pos.z, Math.max(0, pos.h));
    ctx.fillStyle = colors.stripeB;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(3, BALL_RADIUS * p.scale), 0, Math.PI * 2);
    ctx.fill();
  }

  // Power meter.
  ctx.fillStyle = colors.surface;
  ctx.fillRect(WIDTH / 2 - 100, HEIGHT - 58, 200, 14);
  ctx.fillStyle = colors.accent;
  ctx.fillRect(WIDTH / 2 - 100, HEIGHT - 58, 200 * state.power, 14);

  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'left';
  ctx.fillText(`Score ${state.score}`, 16, HEIGHT - 20);
  ctx.textAlign = 'right';
  ctx.fillText(`Balls ${state.balls}/${BALLS_PER_ROUND}`, WIDTH - 16, HEIGHT - 20);
  if (state.last) {
    ctx.textAlign = 'center';
    ctx.fillText(OUTCOME_TEXT[state.last], WIDTH / 2, HEIGHT - 20);
  }

  if (state.phase === 'over') {
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    const cleared = state.coconuts.every((c) => c.down);
    ctx.fillText(
      `${cleared ? 'All down!' : 'Out of balls!'} You scored ${state.score}`,
      WIDTH / 2,
      HEIGHT / 2,
    );
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body');
    ctx.fillText('Click or press Space to play again', WIDTH / 2, HEIGHT / 2 + 40);
  }
}

export const coconutShy: CarnivalGame = {
  id: 'coconut-shy',
  name: 'Coconut Shy',
  description: 'Six balls, five coconuts. Charge your throw and knock them off their posts.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    let state = createState();
    let scoreRecorded = false;
    const held = { left: false, right: false };

    const restart = () => {
      state = createState();
      scoreRecorded = false;
    };
    const press = () => {
      if (state.phase === 'over') restart();
      else startCharge(state);
    };
    const release = () => {
      if (state.charging) throwBall(state);
    };

    const toAim = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      setAim(state, aimForCanvasX(((event.clientX - rect.left) / rect.width) * WIDTH));
    };
    const onMove = (event: PointerEvent) => toAim(event);
    const onDown = (event: PointerEvent) => {
      toAim(event);
      press();
    };
    const onUp = () => release();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') held.left = true;
      else if (event.key === 'ArrowRight') held.right = true;
      else if (event.key === ' ') {
        if (!event.repeat) press();
      } else return;
      event.preventDefault();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') held.left = false;
      else if (event.key === 'ArrowRight') held.right = false;
      else if (event.key === ' ') release();
    };
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    let frame = 0;
    let last = performance.now();
    const loop = (time: number) => {
      // Cap the step so a background tab doesn't teleport everything.
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      if (held.left) nudgeAim(state, -1, dt);
      if (held.right) nudgeAim(state, 1, dt);
      step(state, dt);
      if (state.phase === 'over' && !scoreRecorded) {
        recordScore(coconutShy.id, state.score);
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
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  },
};
