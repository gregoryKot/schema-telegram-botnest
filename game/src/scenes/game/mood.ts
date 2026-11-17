// Цвет как шкала состояния: давление сцены холодит и обесцвечивает мир, кот остаётся тёплым.
// Один прямоугольник-дымка под персонажами и круг света — без пост-эффектов и размытия.
import Phaser from 'phaser';
import { W, H } from '../../constants';
import { addGlow } from '../../look';
import { isHawker } from '../../roadArt';
import type { GameScene } from '../GameScene';
import { chapterWarmth, moodLook, pressureTarget, reliefAt, stepPressure } from './pressure';

const WASH = 0x4c6492, WARM = 0xffc48a, DAWN = 0xffb46a;
const DEPTH = 5.5; // над миром (фон, пол, карнизы, двери), под врагами, подборами и котом

interface Mood {
  wash: Phaser.GameObjects.Rectangle; dawn: Phaser.GameObjects.Rectangle;
  glow: Phaser.GameObjects.Image;
  pressure: number; hurtMs: number; stuckMs: number; reliefMs: number; hearts: number; coping: boolean;
}
const moods = new WeakMap<GameScene, Mood>();

function build(s: GameScene): Mood {
  const rect = (color: number, depth: number, blend: Phaser.BlendModes) =>
    s.add.rectangle(0, 0, W, H, color).setOrigin(0).setScrollFactor(0).setDepth(depth).setBlendMode(blend).setAlpha(0);
  return {
    wash: rect(WASH, DEPTH, Phaser.BlendModes.NORMAL).setName('mood_wash'),
    dawn: rect(DAWN, DEPTH + 0.2, Phaser.BlendModes.ADD),
    glow: addGlow(s, 0, 0, 260, 260, WARM, 0, DEPTH + 0.3),
    pressure: 0, hurtMs: Infinity, stuckMs: 0, reliefMs: Infinity, hearts: s.hearts, coping: false,
  };
}

function enemyDists(s: GameScene): number[] {
  const px = s.player.x, py = s.player.y - 24, out: number[] = [];
  const add = (o: { x: number; y: number }) => out.push(Phaser.Math.Distance.Between(o.x, o.y, px, py));
  for (const a of s.anx) if (a.alive && a.state !== 'calm') add(a.img);
  if (s.critic?.alive) add(s.critic.img);
  for (const m of s.homeMobs) {
    const img = (m as { img?: { x: number; y: number; texture?: { key: string } } }).img;
    if (m.alive && img && !isHawker(img.texture?.key)) add(img); // отговорка манит, а не давит: кадр не холодит
  }
  return out;
}

export function updateMood(s: GameScene, dt: number) {
  let m = moods.get(s);
  if (!m || !m.wash.active) { m = build(s); moods.set(s, m); } // сцена перезапущена — объекты новые

  m.hurtMs = s.hearts < m.hearts ? 0 : m.hurtMs + dt;
  m.hearts = s.hearts;
  m.stuckMs = s.frozen || s.speedMult < 1 ? m.stuckMs + dt : 0;
  const coping = s.frozen || s.dashing || s.attacking;
  m.reliefMs = coping && !m.coping ? 0 : m.reliefMs + dt;
  m.coping = coping;

  const target = pressureTarget({ dists: enemyDists(s), hurtMs: m.hurtMs, stuckMs: m.stuckMs, exhaustion: s.exhaustion });
  m.pressure = stepPressure(m.pressure, target, dt);
  const look = moodLook(m.pressure, reliefAt(m.reliefMs, s.exhaustion),
    chapterWarmth(s.chapter.id, s.player.x / s.chapter.arenaW));
  m.wash.setAlpha(look.wash); m.dawn.setAlpha(look.dawn);
  m.glow.setAlpha(look.glow).setPosition(s.player.x, s.player.y - 22);
}
