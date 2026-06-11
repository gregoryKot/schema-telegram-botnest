import Phaser from 'phaser';
import { S } from '../constants';

type G = Phaser.GameObjects.Graphics;

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    this.load.spritesheet('cat_run',  'assets/cat_run.png',  { frameWidth: 48, frameHeight: 48 });
    this.load.spritesheet('cat_idle', 'assets/cat_idle.png', { frameWidth: 48, frameHeight: 48 });
  }

  create() {
    // Generated tile textures used by the Game engine
    this.tex('plat',   16, 10, g => this.drawPlat(g));
    this.tex('ground', 16, 16, g => this.drawGround(g));
    // Flow: Start → Intro → Game. Dev shortcut: #game jumps straight to a chapter.
    const hash = window.location.hash.slice(1).toLowerCase();
    if (hash === 'game' || hash.startsWith('chapter'))
      this.scene.start('Game', { chapter: hash.startsWith('chapter') ? hash : 'chapter1' });
    else
      this.scene.start('Start');
  }

  private tex(key: string, vw: number, vh: number, draw: (g: G) => void) {
    const g = this.add.graphics();
    draw(g);
    g.generateTexture(key, vw * S, vh * S);
    g.destroy();
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
