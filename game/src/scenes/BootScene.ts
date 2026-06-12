import Phaser from 'phaser';
import { S } from '../constants';
import { makeCommonTextures } from '../textures';

type G = Phaser.GameObjects.Graphics;

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    const cx = Number(this.game.config.width) / 2, cy = Number(this.game.config.height) / 2;
    const loading = this.add.text(cx, cy, 'ЗАГРУЗКА...', {
      fontFamily: 'Courier New', fontSize: '16px', color: '#8a7faa', letterSpacing: 4,
    }).setOrigin(0.5);
    // сеть оборвалась (например, в момент деплоя) — говорим честно, а не молчим
    this.load.on('loaderror', () => {
      loading.setText('НЕ ЗАГРУЗИЛОСЬ\nобнови страницу').setColor('#ff8866').setAlign('center');
    });
    this.load.spritesheet('cat_run',  'assets/cat_run.png',  { frameWidth: 48, frameHeight: 48 });
    this.load.spritesheet('cat_idle', 'assets/cat_idle.png', { frameWidth: 48, frameHeight: 48 });
  }

  create() {
    // битая загрузка — остаёмся на экране с сообщением, дальше только хуже
    if (!this.textures.exists('cat_run') || !this.textures.exists('cat_idle')) return;
    // Generated tile textures used by the Game engine
    this.tex('plat',   16, 10, g => this.drawPlat(g));
    this.tex('ground', 16, 16, g => this.drawGround(g));
    this.tex('plat_room',   16, 10, g => this.drawPlatRoom(g));
    this.tex('ground_room', 16, 16, g => this.drawGroundRoom(g));
    makeCommonTextures(this); // anxmob, heartpk — нужны и прологу, и главам
    // Flow: Start → Intro → Game. Dev shortcut: #game jumps straight to a chapter.
    const hash = window.location.hash.slice(1).toLowerCase();
    if (hash === 'game' || hash.startsWith('chapter'))
      this.scene.start('Game', { chapter: hash.startsWith('chapter') ? hash : 'chapter1' });
    else if (hash === 'tutorial')
      this.scene.start('Tutorial');
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

  // Комната: полка (книжный стеллаж) и дощатый пол — без травы
  private drawPlatRoom(g: G) {
    const TW = 16*S, TH = 10*S;
    g.fillStyle(0x6b4a2e, 1); g.fillRect(0, 0, TW, TH);
    g.fillStyle(0x9a6f44, 1); g.fillRect(0, 0, TW, 1*S);
    g.fillStyle(0x7d5836, 1); g.fillRect(0, 1*S, TW, 1*S);
    g.fillStyle(0x2e1d10, 1); g.fillRect(0, TH-1*S, TW, 1*S);
    g.fillStyle(0x462c18, 1); g.fillRect(0, TH-3*S, TW, 2*S);
    g.fillStyle(0x2e1d10, 0.6);
    g.fillRect(5*S, 1*S, 1, TH-3*S);
    g.fillRect(11*S, 1*S, 1, TH-3*S);
  }

  private drawGroundRoom(g: G) {
    const TW = 16*S, TH = 16*S;
    g.fillStyle(0x4a3220, 1); g.fillRect(0, 0, TW, TH);
    g.fillStyle(0x6b4a2e, 1); g.fillRect(0, 0, TW, 3*S);
    g.fillStyle(0x8a6238, 1); g.fillRect(0, 0, TW, 1*S);
    // стыки досок
    g.fillStyle(0x2e1d10, 0.8);
    g.fillRect(7*S, 0, 1, 3*S);
    g.fillRect(0, 3*S, TW, 1*S);
    g.fillStyle(0x3a2816, 0.7);
    g.fillRect(0, 8*S, TW, 1*S);
    g.fillRect(0, 13*S, TW, 1*S);
    g.fillRect(4*S, 4*S, 1, 4*S);
    g.fillRect(12*S, 9*S, 1, 4*S);
    g.fillStyle(0x9a7244, 0.35);
    g.fillRect(2*S, 1*S, 4*S, 1);
    g.fillRect(10*S, 2*S, 3*S, 1);
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
