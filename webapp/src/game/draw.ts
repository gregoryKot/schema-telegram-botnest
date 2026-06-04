import type { GameState, Player, EnemyInstance, Platform } from './types';
import { obstacleMap } from './obstacles';

export const CANVAS_W = 800;
export const CANVAS_H = 450;
export const GROUND_Y = 370;

// World sky/ground palette
const WORLDS = {
  1: { sky1: '#f5f2eb', sky2: '#e8e0d0', dirt: '#8B7355', grass: '#7a9a5c' },
  2: { sky1: '#e8edf7', sky2: '#d4ddf0', dirt: '#6B7A8D', grass: '#7d9dbf' },
  3: { sky1: '#e8f5ea', sky2: '#d0edd4', dirt: '#5B7A4F', grass: '#6eb86e' },
} as const;

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const ri = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + ri, y);
  ctx.lineTo(x + w - ri, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + ri);
  ctx.lineTo(x + w, y + h - ri);
  ctx.quadraticCurveTo(x + w, y + h, x + w - ri, y + h);
  ctx.lineTo(x + ri, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - ri);
  ctx.lineTo(x, y + ri);
  ctx.quadraticCurveTo(x, y, x + ri, y);
  ctx.closePath();
}

export function drawBackground(ctx: CanvasRenderingContext2D, world: 1 | 2 | 3, camX: number) {
  const c = WORLDS[world];
  const grad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  grad.addColorStop(0, c.sky1);
  grad.addColorStop(1, c.sky2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_W, GROUND_Y);

  // Parallax decorations
  const px = camX * 0.25;
  if (world === 1) {
    ctx.fillStyle = 'rgba(120,100,70,0.12)';
    for (let i = 0; i < 8; i++) {
      const bx = ((i * 320 - px) % (CANVAS_W + 320) + CANVAS_W + 320) % (CANVAS_W + 320) - 160;
      ctx.beginPath();
      ctx.ellipse(bx, GROUND_Y + 5, 160, 55, 0, Math.PI, 0);
      ctx.fill();
    }
  } else if (world === 2) {
    ctx.fillStyle = 'rgba(90,120,180,0.1)';
    ctx.strokeStyle = 'rgba(90,120,180,0.18)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const wx = ((i * 340 - px) % (CANVAS_W + 340) + CANVAS_W + 340) % (CANVAS_W + 340) - 80;
      ctx.fillRect(wx, 70, 64, 100);
      ctx.strokeRect(wx, 70, 64, 100);
      ctx.beginPath();
      ctx.moveTo(wx + 32, 70); ctx.lineTo(wx + 32, 170);
      ctx.moveTo(wx, 120); ctx.lineTo(wx + 64, 120);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = 'rgba(60,100,50,0.18)';
    for (let i = 0; i < 7; i++) {
      const tx = ((i * 220 - px) % (CANVAS_W + 220) + CANVAS_W + 220) % (CANVAS_W + 220) - 60;
      ctx.fillRect(tx + 18, GROUND_Y - 65, 10, 65);
      ctx.beginPath();
      ctx.ellipse(tx + 23, GROUND_Y - 78, 28, 38, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Ground
  ctx.fillStyle = c.grass;
  ctx.fillRect(0, GROUND_Y, CANVAS_W, 10);
  ctx.fillStyle = c.dirt;
  ctx.fillRect(0, GROUND_Y + 10, CANVAS_W, CANVAS_H - GROUND_Y - 10);
}

export function drawPlatform(ctx: CanvasRenderingContext2D, p: Platform, camX: number, world: 1 | 2 | 3) {
  const sx = p.x - camX;
  if (sx > CANVAS_W + 20 || sx + p.w < -20) return;
  const tops = { 1: '#7a9a5c', 2: '#7d9dbf', 3: '#6eb86e' };
  const bots = { 1: '#5a7040', 2: '#5c7a9a', 3: '#4a8a4a' };
  ctx.fillStyle = tops[world];
  rr(ctx, sx, p.y, p.w, 10, 4);
  ctx.fill();
  ctx.fillStyle = bots[world];
  ctx.fillRect(sx, p.y + 10, p.w, p.h - 10);
}

export function drawDoor(ctx: CanvasRenderingContext2D, doorX: number, camX: number) {
  const sx = doorX - camX;
  if (sx > CANVAS_W + 60 || sx < -60) return;
  // Frame
  ctx.fillStyle = '#92400e';
  ctx.fillRect(sx - 3, GROUND_Y - 83, 56, 83);
  ctx.fillStyle = '#78350f';
  ctx.fillRect(sx, GROUND_Y - 80, 50, 80);
  // Door panel
  ctx.fillStyle = '#a16207';
  rr(ctx, sx + 4, GROUND_Y - 76, 42, 76, 4);
  ctx.fill();
  // Window in door
  ctx.fillStyle = 'rgba(200,230,255,0.6)';
  rr(ctx, sx + 10, GROUND_Y - 66, 30, 24, 8);
  ctx.fill();
  // Knob
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(sx + 38, GROUND_Y - 34, 4, 0, Math.PI * 2);
  ctx.fill();
  // "→" sign above door
  ctx.fillStyle = '#4d4799';
  ctx.font = 'bold 13px system-ui';
  ctx.textAlign = 'center';
  ctx.fillText('Дальше →', sx + 25, GROUND_Y - 92);
}

export function drawPlayer(ctx: CanvasRenderingContext2D, p: Player, camX: number) {
  const sx = Math.round(p.x - camX);
  const sy = Math.round(p.y);
  ctx.save();
  ctx.translate(sx, sy);
  if (p.facing < 0) ctx.scale(-1, 1);

  const legSwing = p.onGround && Math.abs(p.vx) > 10
    ? Math.sin(p.frameTimer * 12) * 4
    : 0;

  // Left leg
  ctx.fillStyle = '#334155';
  rr(ctx, -9, -14, 8, 14 + Math.max(0, legSwing), 2);
  ctx.fill();
  // Right leg
  rr(ctx, 1, -14, 8, 14 + Math.max(0, -legSwing), 2);
  ctx.fill();
  // Shoes
  ctx.fillStyle = '#1e293b';
  rr(ctx, -11, -2, 10, 6, 3);
  ctx.fill();
  rr(ctx, 1, -2, 10, 6, 3);
  ctx.fill();
  // Body
  ctx.fillStyle = '#4d4799';
  rr(ctx, -8, -34, 16, 20, 4);
  ctx.fill();
  // Arms
  ctx.fillStyle = '#f4c5a1';
  const armAngle = p.onGround && Math.abs(p.vx) > 10 ? legSwing * 0.5 : 0;
  rr(ctx, -13, -32 + armAngle, 5, 12, 2);
  ctx.fill();
  rr(ctx, 8, -32 - armAngle, 5, 12, 2);
  ctx.fill();
  // Head
  ctx.fillStyle = '#f4c5a1';
  rr(ctx, -8, -52, 16, 18, 7);
  ctx.fill();
  // Hair
  ctx.fillStyle = '#4a3728';
  rr(ctx, -8, -54, 16, 9, 5);
  ctx.fill();
  // Eye
  ctx.fillStyle = '#1c1916';
  ctx.beginPath();
  ctx.arc(4, -42, 2.5, 0, Math.PI * 2);
  ctx.fill();
  // Smile
  ctx.strokeStyle = '#c26060';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(2, -37, 4, 0.2, Math.PI - 0.2);
  ctx.stroke();

  ctx.restore();
}

export function drawEnemy(ctx: CanvasRenderingContext2D, e: EnemyInstance, camX: number) {
  const obs = obstacleMap[e.id];
  if (!obs) return;
  const sx = Math.round(e.x - camX);
  const sy = Math.round(e.y);
  if (sx > CANVAS_W + 80 || sx < -80) return;

  ctx.save();
  ctx.globalAlpha = e.alpha;

  const size = obs.isBoss ? 64 : 44;
  const half = size / 2;

  // Glow for boss
  if (obs.isBoss && e.alpha > 0.5) {
    ctx.shadowColor = obs.color;
    ctx.shadowBlur = 20;
  }

  // Body
  ctx.fillStyle = obs.color;
  ctx.beginPath();
  ctx.ellipse(sx, sy - half, half * 1.1, half, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Emoji
  ctx.font = `${obs.isBoss ? 36 : 26}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = e.alpha;
  ctx.fillText(obs.emoji, sx, sy - half);

  // Name tag
  ctx.font = `bold ${obs.isBoss ? 12 : 10}px system-ui`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = e.alpha * 0.9;
  const label = obs.isBoss ? `⚠ ${obs.name}` : obs.name;
  ctx.fillText(label, sx, sy - size - 8);

  ctx.restore();
}

export function drawHUD(ctx: CanvasRenderingContext2D, world: 1 | 2 | 3, done: number, total: number) {
  const worldNames = { 1: 'До звонка', 2: 'Первые сессии', 3: 'Между сессиями' };
  ctx.fillStyle = 'rgba(28,25,20,0.65)';
  rr(ctx, 12, 12, 220, 36, 10);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px system-ui';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`Мир ${world}: ${worldNames[world]}`, 24, 26);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '11px system-ui';
  ctx.fillText(`${done}/${total} схем понято`, 24, 38);
}

export function drawGame(ctx: CanvasRenderingContext2D, state: GameState) {
  const { world, cameraX, player, enemies, platforms, doorX } = state;
  drawBackground(ctx, world, cameraX);
  platforms.forEach(p => drawPlatform(ctx, p, cameraX, world));
  drawDoor(ctx, doorX, cameraX);
  enemies.forEach(e => drawEnemy(ctx, e, cameraX));
  drawPlayer(ctx, player, cameraX);
  const done = enemies.filter(e => e.understood).length;
  drawHUD(ctx, world, done, enemies.length);
}
