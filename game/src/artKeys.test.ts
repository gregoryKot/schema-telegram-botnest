import { existsSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

// Шов «ключ в коде → файл арта»: небо берётся по имени файла (sky.ts), карниз и пол — по теме главы.
const asset = (name: string) => existsSync(new URL(`./assets/${name}.png`, import.meta.url));

describe('арт глав лежит в assets под ключами из chapters.ts', () => {
  it('у каждой главы есть пол и карниз темы, а у неба — кадр для десктопа и тача', async () => {
    vi.stubGlobal('window', {});
    const { CHAPTERS } = await import('./chapters');
    for (const ch of Object.values(CHAPTERS)) {
      expect(asset(`ground_${ch.theme}`), `ground_${ch.theme}`).toBe(true);
      expect(asset(`ledge_${ch.theme}`), `ledge_${ch.theme}`).toBe(true);
      const sky = ch.palette.sky;
      if (sky) expect([asset(sky), asset(`${sky}_touch`)], sky).toEqual([true, true]);
    }
  });
});

describe('зазывалы гл.3 не считаются давлением', () => {
  it('isHawker узнаёт листы зазывал и не путает их с врагами', async () => {
    const { isHawker } = await import('./roadArt');
    expect(['soothe', 'bargainer', 'crookedmirror'].map(isHawker)).toEqual([true, true, true]);
    expect([isHawker('anxmob'), isHawker('phonemob'), isHawker(undefined)]).toEqual([false, false, false]);
  });
});
