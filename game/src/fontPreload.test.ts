// Шрифт без preload браузер находит только из бандла — поздно: игра стартует запасным шрифтом,
// и Phaser не перерисует текст, когда нужный догрузится (заставка ломалась в Safari).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const faces = [...html.matchAll(/@font-face\s*{[^}]*?url\('([^']+)'\)/g)].map(m => m[1]);
const preloaded = new Set([...html.matchAll(/<link rel="preload" href="([^"]+)" as="font"/g)].map(m => m[1]));

describe('шрифты игры', () => {
  it('нашёл @font-face в index.html', () => expect(faces.length).toBeGreaterThanOrEqual(6));
  it.each(faces)('%s грузится в preload', (src) => expect(preloaded.has(src)).toBe(true));
});
