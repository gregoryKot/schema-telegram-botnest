import type { GameState, Player, EnemyInstance, Platform, InputState } from './types';
import { OBSTACLES } from './obstacles';
import { CANVAS_W, CANVAS_H, GROUND_Y } from './draw';

const GRAVITY = 1400;
const JUMP_VEL = -560;
const PLAYER_W = 18;
const PLAYER_H = 54;
const PLAYER_SPEED = 210;
const ENEMY_SPEED = 55;
const LEVEL_W = 5200;
const DOOR_X = 4750;
const CAM_LEAD = 0.35; // fraction of screen width

function makePlatforms(): Platform[] {
  return [
    { x: 420, y: GROUND_Y - 90, w: 130, h: 20 },
    { x: 900, y: GROUND_Y - 75, w: 140, h: 20 },
    { x: 1380, y: GROUND_Y - 100, w: 120, h: 20 },
    { x: 1900, y: GROUND_Y - 85, w: 150, h: 20 },
    { x: 2450, y: GROUND_Y - 95, w: 130, h: 20 },
    { x: 3050, y: GROUND_Y - 80, w: 140, h: 20 },
    { x: 3600, y: GROUND_Y - 110, w: 120, h: 20 },
    { x: 4200, y: GROUND_Y - 75, w: 150, h: 20 },
  ];
}

function makeEnemies(world: 1 | 2 | 3): EnemyInstance[] {
  const ids = OBSTACLES.filter(o => o.world === world).map(o => o.id);
  const positions = [700, 1450, 2200, 3100, 3900];
  return ids.map((id, i) => ({
    id,
    x: positions[i],
    y: GROUND_Y,
    patrolMin: positions[i] - 80,
    patrolMax: positions[i] + 80,
    dir: -1 as const,
    understood: false,
    alpha: 1,
  }));
}

export function createWorld(world: 1 | 2 | 3): GameState {
  return {
    player: {
      x: 80, y: GROUND_Y - PLAYER_H,
      vx: 0, vy: 0,
      onGround: false, facing: 1,
      frame: 0, frameTimer: 0,
    },
    enemies: makeEnemies(world),
    platforms: makePlatforms(),
    phase: 'playing',
    hitEnemyId: null,
    world,
    cameraX: 0,
    doorX: DOOR_X,
    levelW: LEVEL_W,
  };
}

function aabb(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function resolvePlayerPlatforms(player: Player, platforms: Platform[]) {
  const px = player.x - PLAYER_W / 2;
  const py = player.y - PLAYER_H;

  for (const p of platforms) {
    if (!aabb(px, py, PLAYER_W, PLAYER_H, p.x, p.y, p.w, p.h)) continue;
    // Only land on top (falling down)
    if (player.vy >= 0 && py + PLAYER_H - player.vy * 0.02 <= p.y + 4) {
      player.y = p.y + PLAYER_H;
      player.vy = 0;
      player.onGround = true;
    }
  }
}

export function update(
  state: GameState,
  dt: number,
  input: InputState,
  onHit: (id: string) => void,
) {
  if (state.phase !== 'playing') return;
  const { player, enemies, platforms } = state;

  // ── Player movement ──────────────────────────────────────────────────────
  if (input.left) { player.vx = -PLAYER_SPEED; player.facing = -1; }
  else if (input.right) { player.vx = PLAYER_SPEED; player.facing = 1; }
  else player.vx *= 0.75;

  if (input.jumpPressed && player.onGround) {
    player.vy = JUMP_VEL;
    player.onGround = false;
  }

  player.vy += GRAVITY * dt;
  player.x = Math.max(PLAYER_W / 2, Math.min(state.levelW - PLAYER_W / 2, player.x + player.vx * dt));
  player.y += player.vy * dt;

  // Ground collision
  player.onGround = false;
  if (player.y >= GROUND_Y) {
    player.y = GROUND_Y;
    player.vy = 0;
    player.onGround = true;
  }

  // Platform collisions
  resolvePlayerPlatforms(player, platforms);

  // Ceiling
  if (player.y - PLAYER_H < 0) {
    player.y = PLAYER_H;
    player.vy = Math.max(0, player.vy);
  }

  // Frame animation
  player.frameTimer += dt;
  if (player.frameTimer > 0.12) {
    player.frame++;
    player.frameTimer = 0;
  }

  // ── Enemies ──────────────────────────────────────────────────────────────
  for (const e of enemies) {
    if (e.understood) {
      e.alpha = Math.max(0.25, e.alpha - dt * 1.5);
      continue;
    }

    // Patrol
    e.x += e.dir * ENEMY_SPEED * dt;
    if (e.x >= e.patrolMax) { e.dir = -1; }
    if (e.x <= e.patrolMin) { e.dir = 1; }

    // Collision with player
    const eSize = 44;
    const playerHit = aabb(
      player.x - PLAYER_W / 2, player.y - PLAYER_H, PLAYER_W, PLAYER_H,
      e.x - eSize / 2, e.y - eSize, eSize, eSize,
    );
    if (playerHit) {
      state.phase = 'paused';
      state.hitEnemyId = e.id;
      onHit(e.id);
      return;
    }
  }

  // ── Camera ────────────────────────────────────────────────────────────────
  const targetCam = player.x - CANVAS_W * CAM_LEAD;
  state.cameraX += (targetCam - state.cameraX) * Math.min(1, dt * 8);
  state.cameraX = Math.max(0, Math.min(state.levelW - CANVAS_W, state.cameraX));

  // ── Door check ────────────────────────────────────────────────────────────
  if (player.x > state.doorX - 40) {
    state.phase = 'victory';
  }
}

export function dismissEnemy(state: GameState) {
  const e = state.enemies.find(e => e.id === state.hitEnemyId);
  if (e) e.understood = true;
  // Push player back slightly so no immediate re-hit
  state.player.x -= 60 * state.player.facing;
  state.hitEnemyId = null;
  state.phase = 'playing';
}

export { CANVAS_W, CANVAS_H };
