import Phaser from 'phaser';
import { S, C } from '../constants';

type G = Phaser.GameObjects.Graphics;

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    this.load.image('bg-mountains', 'assets/bg-mountains.png');
    this.load.image('bg-moon', 'assets/bg-moon.png');
    this.load.spritesheet('cat_run',  'assets/cat_run.png',  { frameWidth: 48, frameHeight: 48 });
    this.load.spritesheet('cat_idle', 'assets/cat_idle.png', { frameWidth: 48, frameHeight: 48 });
  }

  create() {
    this.tex('sage',            26, 48, g => this.drawSage(g));
    this.tex('anxiety',         20, 10, g => this.drawAnxiety(g));
    this.tex('procrastination', 20, 10, g => this.drawProcrastination(g));
    this.tex('phone',           10, 16, g => this.drawPhone(g));
    this.tex('irritation',      20, 10, g => this.drawIrritation(g));
    this.tex('selfcritic',      20, 10, g => this.drawSelfcritic(g));
    this.tex('plat',            16, 10, g => this.drawPlat(g));
    this.tex('ground',          16, 16, g => this.drawGround(g));
    this.scene.start('Start');
  }

  private tex(key: string, vw: number, vh: number, draw: (g: G) => void) {
    const g = this.add.graphics();
    draw(g);
    g.generateTexture(key, vw * S, vh * S);
    g.destroy();
  }

  // ── Pill base — no background, pure capsule shape ─────────────────────
  private pill(g: G, W: number, H: number, cL: number, cR: number) {
    const u = S, r = H / 2;
    // Left half: rounded left cap, square right edge at midpoint
    g.fillStyle(cL, 1);
    g.fillRoundedRect(0, 0, W * u, H * u, r * u);
    // Right half overlay
    g.fillStyle(cR, 1);
    g.fillRoundedRect((W / 2) * u, 0, (W / 2) * u, H * u,
      { tl: 0, tr: r * u, bl: 0, br: r * u } as Phaser.Types.GameObjects.Graphics.RoundedRectRadius);
    // Seam
    g.fillStyle(0x000000, 0.22);
    g.fillRect((W / 2) * u, u, 1, (H - 2) * u);
    // Highlight
    g.fillStyle(0xffffff, 0.22);
    g.fillRect((r + 1) * u, u, (W - 2 * r - 2) * u, u);
  }

  // ── Anxiety — amber/red · vortex ─────────────────────────────────────
  private drawAnxiety(g: G) {
    const u = S, W = 20, H = 10;
    this.pill(g, W, H, 0xE8A020, 0xD02828);
    const cx = (W / 2) * u, cy = (H / 2) * u;
    g.fillStyle(0xFF8800, 0.5); g.fillEllipse(cx, cy, 5 * u, 3 * u);
    g.fillStyle(0xFFDD00, 0.7); g.fillEllipse(cx, cy, 2.5 * u, 2 * u);
    g.fillStyle(0x1A0800, 1);   g.fillCircle(cx, cy, u * 0.7);
  }

  // ── Procrastination — slate/grey · ZZZ ───────────────────────────────
  private drawProcrastination(g: G) {
    const u = S, W = 20, H = 10;
    this.pill(g, W, H, 0x4A7090, 0x7A8898);
    const drawZ = (bx: number, by: number, sz: number, a: number) => {
      g.fillStyle(0xffffff, a);
      g.fillRect(bx * u, by * u, sz * u, u);
      for (let d = 0; d < sz; d++)
        g.fillRect((bx + sz - 1 - d) * u, (by + 1 + d) * u, u, u);
      g.fillRect(bx * u, (by + sz) * u, sz * u, u);
    };
    drawZ(4, 2, 3, 0.75);
    drawZ(10, 1, 2, 0.55);
    drawZ(15, 3, 2, 0.38);
  }

  // ── Phone — vertical dark · scroll ───────────────────────────────────
  private drawPhone(g: G) {
    const u = S;
    g.fillStyle(0x0D1B2A, 1); g.fillRoundedRect(0, 0, 10 * u, 16 * u, 1.5 * u);
    g.fillStyle(0x1A2F4A, 1); g.fillRoundedRect(u * 0.5, u * 0.5, 9 * u, 15 * u, u);
    g.fillStyle(0x0A1628, 1); g.fillRoundedRect(u, u, 8 * u, 10 * u, u * 0.5);
    for (let i = 0; i < 3; i++) {
      g.fillStyle(0x5B9BD5, Math.max(0.1, 0.6 - i * 0.15));
      g.fillRect(1.5 * u, (2.5 + i * 2.5) * u, 7 * u, u * 0.7);
    }
    g.fillStyle(0xFF3040, 1); g.fillCircle(8 * u, 1.5 * u, u * 0.5);
    g.fillStyle(0x2A3F58, 1); g.fillRoundedRect(3.5 * u, 13 * u, 3 * u, u * 0.7, u * 0.3);
  }

  // ── Irritation — orange/crimson · lightning ───────────────────────────
  private drawIrritation(g: G) {
    const u = S, W = 20, H = 10;
    this.pill(g, W, H, 0xFF6600, 0xBB1100);
    g.fillStyle(0xFFEE66, 0.95);
    g.fillRect(9 * u, u, 4 * u, 1.5 * u);    // top →
    g.fillRect(11 * u, 2.5 * u, 1.5 * u, 2 * u); // down
    g.fillRect(7 * u, 4.5 * u, 6 * u, 1.5 * u);  // mid ←
    g.fillRect(7 * u, 6 * u, 1.5 * u, 2 * u); // down
    g.fillRect(7 * u, 8 * u, 4 * u, 1.5 * u); // bot →
  }

  // ── Self-Critic — purple/black · eye ─────────────────────────────────
  private drawSelfcritic(g: G) {
    const u = S, W = 20, H = 10;
    this.pill(g, W, H, 0x560090, 0x180428);
    g.fillStyle(0xEEDDFF, 0.8);  g.fillEllipse(11 * u, 5 * u, 7 * u, 4 * u);
    g.fillStyle(0x9B30CC, 1);    g.fillCircle(11 * u, 5 * u, 1.6 * u);
    g.fillStyle(0x080010, 1);    g.fillCircle(11.3 * u, 5.3 * u, u);
    g.fillStyle(0xBB88FF, 0.8);
    g.fillCircle(9.5 * u, 8 * u, u * 0.6);
    g.fillTriangle(9 * u, 8 * u, 10 * u, 8 * u, 9.5 * u, 9.5 * u);
  }

  // ── Sage ──────────────────────────────────────────────────────────────
  private drawSage(g: G) {
    const u = S;
    g.fillStyle(C.sage, 0.04); g.fillEllipse(13*u, 30*u, 34*u, 55*u);
    g.fillStyle(C.sage, 0.06); g.fillEllipse(13*u, 30*u, 26*u, 46*u);
    g.fillStyle(C.sageDk, 1);
    g.fillRoundedRect(1*u, 2*u, 3*u, 46*u, 2);
    g.fillStyle(C.sage, 0.3); g.fillCircle(2*u, 2*u, 4*u);
    g.fillStyle(C.sage, 0.6); g.fillCircle(2*u, 2*u, 3*u);
    g.fillStyle(0xffffff, 0.9); g.fillCircle(2*u, 2*u, 1.5*u);
    g.fillStyle(C.sageDk, 1);
    g.fillRoundedRect(2*u, 28*u, 22*u, 20*u, 4);
    g.fillRoundedRect(0*u, 36*u, 26*u, 12*u, 3);
    g.fillRoundedRect(4*u, 14*u, 18*u, 15*u, 5);
    g.fillStyle(C.sage, 0.12); g.fillRoundedRect(8*u, 14*u, 10*u, 34*u, 3);
    g.fillStyle(C.sage, 0.15);
    g.fillRect(7*u, 28*u, 2*u, 16*u); g.fillRect(17*u, 28*u, 2*u, 16*u);
    g.fillStyle(C.sageDk, 1);
    g.fillRoundedRect(3*u, 2*u, 20*u, 15*u, 8);
    g.fillRoundedRect(2*u, 7*u, 22*u, 10*u, 4);
    g.fillStyle(0xc0e8d0, 1); g.fillCircle(13*u, 12*u, 7*u);
    g.fillStyle(0x0f2a1a, 0.6); g.fillCircle(13*u, 9*u, 7*u);
    g.fillStyle(C.sage, 1);
    g.fillCircle(10*u, 12*u, 2.5*u); g.fillCircle(16*u, 12*u, 2.5*u);
    g.fillStyle(0xffffff, 0.95);
    g.fillCircle(10*u, 12*u, 1.2*u); g.fillCircle(16*u, 12*u, 1.2*u);
    g.fillStyle(C.sage, 0.25);
    g.fillRoundedRect(3*u, 2*u, 3*u, 13*u, 2);
    g.fillRoundedRect(20*u, 2*u, 3*u, 13*u, 2);
    g.fillStyle(C.sageDk, 1);
    g.fillRoundedRect(3*u, 22*u, 5*u, 4*u, 2);
    g.fillRoundedRect(18*u, 22*u, 5*u, 4*u, 2);
    g.fillStyle(C.sage, 0.5);
    g.fillCircle(5*u, 27*u, 2.5*u); g.fillCircle(21*u, 27*u, 2.5*u);
  }

  // ── Platform / Ground ─────────────────────────────────────────────────
  private drawPlat(g: G) {
    g.fillStyle(C.platH); g.fillRect(0, 0, 16*S, 3*S);
    g.fillStyle(C.plat);  g.fillRect(0, 3*S, 16*S, 7*S);
    g.fillStyle(0x6a5aff, 0.2); g.fillRect(2*S, 5*S, 12*S, 2*S);
  }

  private drawGround(g: G) {
    g.fillStyle(C.groundH); g.fillRect(0, 0, 16*S, 3*S);
    g.fillStyle(C.ground);  g.fillRect(0, 3*S, 16*S, 13*S);
    g.fillStyle(0x2a2060, 0.4); g.fillRect(3*S, 7*S, 2*S, 2*S);
    g.fillStyle(0x2a2060, 0.2); g.fillRect(9*S, 5*S, 2*S, 2*S);
  }
}
