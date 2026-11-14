// Терапевт гл.4 — свой спрайт (game/art/doc.py): старший дымчатый кот в очках, с пледом.
import Phaser from 'phaser';
import type { GameScene } from '../GameScene';

function anim(s: Phaser.Scene, key: string, sheet: string, end: number, rate: number) {
  if (s.anims.exists(key) || !s.textures.exists(sheet)) return;
  s.anims.create({ key, frames: s.anims.generateFrameNumbers(sheet, { start: 0, end }), frameRate: rate, repeat: -1 });
}

// Лист догружается в фоне (sprites-heavy.ts); не доехал — прежний кот с тинтом.
export function addTherapist(s: GameScene, x: number, y: number, depth: number): Phaser.GameObjects.Sprite {
  anim(s, 'doc-idle', 'doc_idle', 7, 5);
  anim(s, 'doc-talk', 'doc_talk', 3, 6);
  const own = s.anims.exists('doc-idle');
  const doc = s.add.sprite(x, y, own ? 'doc_idle' : 'cat_idle').setOrigin(0.5, 1)
    .setScale(own ? 1.5 : 1.7).setFlipX(true).setScrollFactor(0).setDepth(depth).setAlpha(0)
    .play(own ? 'doc-idle' : 'p-idle');
  if (!own) doc.setTint(0x9ac8a8);
  return doc;
}

/** Пока звучит реплика терапевта — лёгкое движение головы, потом снова дыхание. */
export function talk(s: GameScene, doc: Phaser.GameObjects.Sprite, ms: number) {
  if (!doc.active || !s.anims.exists('doc-talk') || doc.texture.key !== 'doc_idle') return;
  doc.play('doc-talk');
  s.time.delayedCall(ms, () => { if (doc.active) doc.play('doc-idle'); });
}
