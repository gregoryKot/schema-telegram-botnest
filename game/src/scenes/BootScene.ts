import Phaser from 'phaser';
import { S, C } from '../constants';

type G = Phaser.GameObjects.Graphics;

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    // Level 1 — morning
    this.load.image('bg-mountains', 'assets/bg-mountains.png');
    this.load.image('bg-moon',      'assets/bg-moon.png');

    // Level 2 — cemetery
    this.load.image('bg_night_sky',    'assets/bg_night_sky.png');
    this.load.image('bg_cemetery_mid', 'assets/bg_cemetery_mid.png');
    this.load.image('bg_graves1',      'assets/bg_graves1.png');
    this.load.image('bg_graves2',      'assets/bg_graves2.png');
    this.load.image('cem_ground',      'assets/cem_ground.png');
    this.load.image('cem_wall',        'assets/cem_wall.png');
    this.load.image('cem_bush',        'assets/cem_bush.png');
    this.load.image('cem_statue',      'assets/cem_statue.png');

    // Level 3 — dungeon
    this.load.image('dun_ground', 'assets/dun_ground.png');
    this.load.image('dun_wall',   'assets/dun_wall.png');
    this.load.image('dun_room',   'assets/dun_room.png');

    // Cat sprites
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
    // Debug: jump to scene via URL hash (e.g. /#Cemetery, /#Dungeon)
    const target = window.location.hash.slice(1) || 'Start';
    this.scene.start(target);
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

  // ── Sage — serene seated robed figure, soft green glow ────────────────
  private drawSage(g: G) {
    const u = S;
    const pt = (x: number, y: number) => ({ x: x * u, y: y * u });

    // Soft aura behind the figure (calm green)
    g.fillStyle(0x66ffbb, 0.05); g.fillCircle(13*u, 26*u, 24*u);
    g.fillStyle(0x66ffbb, 0.07); g.fillCircle(13*u, 24*u, 16*u);

    // Robe — a calm trapezoid (broad, grounded base)
    g.fillStyle(0x16382a, 1);
    g.fillPoints([pt(8,17), pt(18,17), pt(24,47), pt(2,47)], true);
    // Robe inner highlight (subtle vertical light)
    g.fillStyle(0x245a40, 1);
    g.fillPoints([pt(11,18), pt(15,18), pt(17,47), pt(9,47)], true);
    // Folded hands at center (meditation)
    g.fillStyle(0xbfe8cf, 0.9); g.fillEllipse(13*u, 33*u, 7*u, 4*u);
    g.fillStyle(0x16382a, 1);   g.fillRect(12.4*u, 31*u, 1.2*u, 4*u);

    // Hood / shoulders
    g.fillStyle(0x16382a, 1);
    g.fillRoundedRect(5*u, 14*u, 16*u, 8*u, 4*u);

    // Halo behind head
    g.fillStyle(0x88ffcc, 0.18); g.fillCircle(13*u, 10*u, 8*u);
    g.fillStyle(0x88ffcc, 0.30); g.fillCircle(13*u, 10*u, 6*u);

    // Head — soft glowing orb
    g.fillStyle(0xd6f2e0, 1); g.fillCircle(13*u, 10*u, 5.5*u);
    g.fillStyle(0xeefff6, 0.9); g.fillCircle(13*u, 9*u, 3.5*u);

    // Hood brim over head
    g.fillStyle(0x16382a, 1);
    g.fillRoundedRect(6*u, 3*u, 14*u, 6*u, 3*u);

    // Calm closed eyes (two gentle arcs)
    g.fillStyle(0x2a4a38, 1);
    g.fillRect(9.5*u, 11*u, 2.5*u, 0.8*u);
    g.fillRect(14*u, 11*u, 2.5*u, 0.8*u);

    // Tiny floating leaf accent (the 🌿 motif)
    g.fillStyle(0x7fffb0, 0.8);
    g.fillEllipse(21*u, 24*u, 3*u, 1.6*u);
  }

  // ── Platform / Ground ─────────────────────────────────────────────────
  private drawPlat(g: G) {
    const TW = 16*S, TH = 10*S;
    g.fillStyle(0x8B4513, 1); g.fillRect(0, 0, TW, TH);
    g.fillStyle(0xD2691E, 1); g.fillRect(0, 0, TW, 1*S);
    g.fillStyle(0xA0522D, 1); g.fillRect(0, 1*S, TW, 2*S);
    g.fillStyle(0x3d1a05, 1); g.fillRect(0, TH-1*S, TW, 1*S);
    g.fillStyle(0x5C2E0A, 1); g.fillRect(0, TH-2*S, TW, 1*S);
    g.fillStyle(0x5C2E0A, 0.55);
    g.fillRect(4*S,  1*S, 1, TH-2*S);
    g.fillRect(8*S,  1*S, 1, TH-2*S);
    g.fillRect(12*S, 1*S, 1, TH-2*S);
    g.fillStyle(0x3d1a05, 0.6); g.fillEllipse(6*S, 5*S, 2*S, 3*S);
    g.fillStyle(0xffd080, 0.6);
    g.fillRect(2*S, 2*S, 1, 1);
    g.fillRect(10*S, 2*S, 1, 1);
  }

  private drawGround(g: G) {
    const TW = 16*S, TH = 16*S;
    g.fillStyle(0x3d1a08, 1); g.fillRect(0, 0, TW, TH);
    g.fillStyle(0x5a2a12, 1); g.fillRect(0, 3*S, TW, TH-3*S);
    g.fillStyle(0x2d6614, 1); g.fillRect(0, 0, TW, 3*S);
    g.fillStyle(0x4a9a22, 1); g.fillRect(0, 0, TW, 1*S);
    g.fillStyle(0x5ab82a, 1);
    for (let x = 1; x < 15; x += 3) g.fillRect(x*S, 0, 1, 1*S);
    g.fillStyle(0x1a0e06, 0.5); g.fillRect(0, 3*S, TW, 1*S);
    g.fillStyle(0x2a1008, 0.55);
    g.fillRect(2*S, 6*S, 2*S, 1*S);
    g.fillRect(8*S, 9*S, 2*S, 1*S);
    g.fillRect(13*S, 5*S, 1*S, 1*S);
    g.fillRect(5*S, 12*S, 2*S, 1*S);
    g.fillStyle(0x4a2010, 0.2);
    g.fillRect(0, 7*S, TW, 1*S);
    g.fillRect(0, 12*S, TW, 1*S);
  }
}
