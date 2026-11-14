import Phaser from 'phaser';

// Мягкий свет: радиальный градиент в текстуре, растянутый под нужный эллипс.
// Не размытие (blur режет PWA) и не полупрозрачный эллипс с жёстким краем.
const KEY = 'soft_glow';
const SIZE = 128;

function ensureTexture(scene: Phaser.Scene) {
  if (scene.textures.exists(KEY)) return;
  const tex = scene.textures.createCanvas(KEY, SIZE, SIZE);
  if (!tex) return;
  const ctx = tex.getContext();
  const r = SIZE / 2;
  const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grad.addColorStop(0.7, 'rgba(255,255,255,0.15)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, SIZE, SIZE);
  tex.refresh();
  // градиент тянется в разы — ближайший сосед дал бы ступени
  tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
}

/** Пятно мягкого света: центр (x, y), полуоси w/2 × h/2, цвет и яркость в центре. */
export function addGlow(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  color: number,
  alpha: number,
  depth: number,
): Phaser.GameObjects.Image {
  ensureTexture(scene);
  return scene.add
    .image(x, y, KEY)
    .setDisplaySize(w, h)
    .setTint(color)
    .setAlpha(alpha)
    .setDepth(depth)
    .setBlendMode(Phaser.BlendModes.ADD);
}

// Тёмная обводка текста поверх сцены: HUD и подписи читаются на любом фоне
export const HUD_STROKE = { stroke: '#120a1e', strokeThickness: 4 };
