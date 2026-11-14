// Геометрия и атмосфера уровня: фон, земля, карнизы, шипы, сердца, воспоминания.
import Phaser from 'phaser';
import { W, H, GROUND_Y, S } from '../../constants';
import { LEDGE } from '../../props';
import { buildGroundStrip, groundKey } from '../../ground';
import { addGlow } from '../../look';
import type { GameScene } from '../GameScene';

// ── Atmosphere — inside a restless mind ─────────────────────────────────────
export function buildBackground(s: GameScene) {
  const ARENA_W = s.chapter.arenaW;
  const pal = s.chapter.palette;
  const g = s.add.graphics().setScrollFactor(0).setDepth(-9);
  g.fillGradientStyle(pal.skyTop, pal.skyTop, pal.skyBot, pal.skyBot, 1, 1, 1, 1);
  g.fillRect(0, 0, W, H);
  // distant glow lighting the play zone
  addGlow(s, W / 2, GROUND_Y - 10, W * 1.8, 420, pal.glow1, 0.30, -8).setScrollFactor(0);
  addGlow(s, W / 2, GROUND_Y - 10, W * 1.1, 260, pal.glow2, 0.22, -8).setScrollFactor(0);
  // drifting "thought" motes (parallax)
  for (let layer = 0; layer < 2; layer++) {
    const depth = layer === 0 ? -7 : -3;
    const sf = layer === 0 ? 0.2 : 0.5;
    const cont = s.add.container(0, 0).setScrollFactor(sf).setDepth(depth);
    for (let i = 0; i < 14; i++) {
      const m = s.add.rectangle(Phaser.Math.Between(0, ARENA_W), Phaser.Math.Between(40, GROUND_Y - 30),
        2 + layer, 2 + layer, pal.mote, 0.18 + layer * 0.12);
      cont.add(m);
      s.tweens.add({ targets: m, y: m.y - Phaser.Math.Between(20, 60), x: m.x + Phaser.Math.Between(-30, 30),
        alpha: 0, duration: 4000 + Math.random() * 3000, repeat: -1, delay: i * 300,
        onRepeat: () => { m.y = GROUND_Y - 30; m.x = Phaser.Math.Between(0, ARENA_W); m.alpha = 0.2; } });
    }
  }
  // low fog band
  const fog = s.add.graphics().setScrollFactor(0).setDepth(-2);
  fog.fillGradientStyle(pal.fog, pal.fog, pal.fog, pal.fog, 0, 0, 0.55, 0.55);
  fog.fillRect(0, GROUND_Y - 80, W, 90);
  // vignette (soft)
  const vig = s.add.graphics().setScrollFactor(0).setDepth(58);
  vig.fillStyle(0x000000, 0.28);
  vig.fillRect(0, 0, W, 16); vig.fillRect(0, H - 16, W, 16);
  vig.fillRect(0, 0, 28, H); vig.fillRect(W - 28, 0, 28, H);
}

export function buildGround(s: GameScene) {
  const ARENA_W = s.chapter.arenaW, pits = s.chapter.pits;
  const key = groundKey(s.chapter.theme);
  const edges = [0, ...pits.flatMap(p => [p.s, p.e]), ARENA_W];
  for (let i = 0; i < edges.length - 1; i += 2) {
    const sx = edges[i], ex = edges[i + 1], w = ex - sx;
    buildGroundStrip(s, key, sx, ex, 2);
    const r = s.add.rectangle(sx + w / 2, GROUND_Y + 20, w, 40, 0, 0);
    s.physics.add.existing(r, true);
    s.floorColliders.push(r);
  }
}

// ── Level geometry: a deliberate line — intro · gaps · spikes · climb · gauntlet
export function buildPlatforms(s: GameScene) {
  const tw = 16 * S, th = 10 * S;
  const P = s.chapter.platforms;
  const ledge = s.chapter.theme === 'room' ? LEDGE.room : LEDGE.street;
  const platTex = s.chapter.theme === 'room' ? 'plat_room' : 'plat';
  const LH = 16; // карниз 48×16 в логических пикселях, показ ×2; верх — поверхность (p.y)
  for (const p of P) {
    if (s.textures.exists(ledge.key)) {
      // настоящий карниз: торцы не тянутся, середина растягивается под ширину
      s.add.nineslice(p.x + p.w / 2, p.y + LH, ledge.key, undefined, p.w / 2, LH, ledge.cap, ledge.cap, 0, 0).setScale(2).setDepth(2);
    } else {
      const cols = Math.ceil(p.w / tw); // запасной процедурный тайл
      for (let i = 0; i < cols; i++)
        s.add.image(p.x + i * tw + tw / 2, p.y + th / 2, platTex).setDepth(2).setTint(s.chapter.palette.platTint);
    }
    const r = s.add.rectangle(p.x + p.w / 2, p.y + 5 * S, p.w, th, 0, 0);
    s.physics.add.existing(r, true);
    s.platColliders.push(r);
  }
}

// ── Spikes — sharp intrusive thoughts; touching costs a heart ───────────────
export function buildSpikes(s: GameScene) {
  const defs = s.chapter.spikes;
  for (const d of defs) {
    const g = s.add.graphics().setDepth(3);
    const n = Math.floor(d.w / 16);
    for (let i = 0; i < n; i++) {
      const sx = d.x + i * 16;
      g.fillStyle(0x2a1330, 1); g.fillTriangle(sx, GROUND_Y, sx + 16, GROUND_Y, sx + 8, GROUND_Y - 22);
      g.fillStyle(0xb04050, 1); g.fillTriangle(sx + 5, GROUND_Y, sx + 11, GROUND_Y, sx + 8, GROUND_Y - 20);
    }
    s.spikeRects.push({ x: d.x, w: d.w });
  }
}

// ── Hearts — scattered; some easy, some high over gaps (reach for it) ───────
export function buildHearts(s: GameScene) {
  const spots = s.chapter.hearts;
  for (const sp of spots) {
    const img = s.add.image(sp.x, sp.y, 'heartpk').setDepth(7).setScale(0.8);
    s.tweens.add({ targets: img, y: sp.y - 8, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    s.heartPickups.push(img);
  }
}

// Тёплые воспоминания — коллектиблы; часть на секретных верхних маршрутах
export function buildMemories(s: GameScene) {
  const spots = s.chapter.memories ?? [];
  s.memTotal = spots.length;
  for (const sp of spots) {
    const img = s.add.sprite(sp.x, sp.y, 'memory').setDepth(7).setScale(0.9);
    if (s.anims.exists('memory-twinkle')) img.play('memory-twinkle');
    s.tweens.add({ targets: img, y: sp.y - 7, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    s.memories.push(img);
  }
}
