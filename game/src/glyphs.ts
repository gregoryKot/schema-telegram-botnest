// Значки HUD и тач-кнопок — пиксельные битмапы вместо знаков, которых нет в Press Start 2P.
// '#' — закрашенный пиксель. Рисуются в canvas: Phaser-текстурой (HUD) или data-URI (HTML-кнопки).
export const GLYPHS = {
  heart: ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'],
  spark: ['...#...', '...#...', '..###..', '#######', '..###..', '...#...', '...#...'],
  ruble: ['.####..', '.#...#.', '.#...#.', '.####..', '###....', '.#.....', '.#.....'],
  left:  ['...#', '..##', '.###', '####', '.###', '..##', '...#'],
  right: ['#...', '##..', '###.', '####', '###.', '##..', '#...'],
  up:    ['...#...', '..###..', '.#####.', '#######'],
} as const;
export type GlyphName = keyof typeof GLYPHS;

export function glyphRects(name: GlyphName): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  GLYPHS[name].forEach((row, y) => [...row].forEach((c, x) => { if (c === '#') out.push({ x, y }); }));
  return out;
}

export function glyphSize(name: GlyphName, px: number) {
  const rows = GLYPHS[name];
  return { w: rows[0].length * px, h: rows.length * px };
}

/** Холст со значком; pad — поля, bg — подложка (для ₽ на коричневой плашке). */
export function glyphCanvas(name: GlyphName, color: string, px: number, pad = 0, bg?: string): HTMLCanvasElement {
  const { w, h } = glyphSize(name, px);
  const c = document.createElement('canvas');
  c.width = w + pad * 2; c.height = h + pad * 2;
  const g = c.getContext('2d');
  if (!g) return c;
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); }
  g.fillStyle = color;
  for (const r of glyphRects(name)) g.fillRect(pad + r.x * px, pad + r.y * px, px, px);
  return c;
}

export function glyphDataUri(name: GlyphName, color: string, px: number): string {
  return glyphCanvas(name, color, px).toDataURL();
}

/** Ключ текстуры значка в сцене; создаётся один раз на (имя, цвет, масштаб, подложка). */
export function glyphTexture(scene: Phaser.Scene, name: GlyphName, color: string, px: number, pad = 0, bg?: string): string {
  const key = `glyph_${name}_${color}_${px}_${pad}_${bg ?? ''}`;
  if (!scene.textures.exists(key)) scene.textures.addCanvas(key, glyphCanvas(name, color, px, pad, bg));
  return key;
}

export const HEART_FULL = '#ff5577';
export const HEART_EMPTY = '#4a2a3a';

/** Ряд из n сердец (max — слотов); неполные слоты — тёмные. Создаётся один раз, дальше — setHearts. */
export function buildHearts(scene: Phaser.Scene, x: number, y: number, max: number, depth: number): Phaser.GameObjects.Image[] {
  const full = glyphTexture(scene, 'heart', HEART_FULL, 3);
  return Array.from({ length: max }, (_, i) =>
    scene.add.image(x + i * 28, y, full).setOrigin(0, 0).setScrollFactor(0).setDepth(depth));
}

export function setHearts(scene: Phaser.Scene, imgs: Phaser.GameObjects.Image[], n: number): void {
  const full = glyphTexture(scene, 'heart', HEART_FULL, 3), empty = glyphTexture(scene, 'heart', HEART_EMPTY, 3);
  imgs.forEach((img, i) => { img.setTexture(i < n ? full : empty); img.setVisible(i < Math.max(n, 3)); });
}
