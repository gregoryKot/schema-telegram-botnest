import { HOME_TILES } from '../analytics/home-events.constants';
import { formatHomeTiles, HOME_TILE_LABELS } from './home-tiles.format';

describe('formatHomeTiles — нажатия плиток главной', () => {
  it('пустая БД: строки нет, в блоке нет «0», NaN и голых id', () => {
    expect(formatHomeTiles([])).toBeNull();
    expect(
      formatHomeTiles(HOME_TILES.map((tile) => ({ tile, count: 0 }))),
    ).toBeNull();
  });

  it('есть данные: подписи словами в порядке экрана, нули не печатаются', () => {
    const line = formatHomeTiles([
      { tile: 'diary', count: 3 },
      { tile: 'tracker', count: 12 },
      { tile: 'calm', count: 1 },
      { tile: 'case', count: 0 },
    ]);
    expect(line).toBe('Главная: плитки — Трекер 12, Дневник 3, Подышать 1');
    expect(line).not.toMatch(/tracker|diary|calm|NaN|undefined/);
  });

  it('у каждой плитки из реестра есть человеческая подпись', () => {
    for (const tile of HOME_TILES) {
      expect(HOME_TILE_LABELS[tile]).toBeTruthy();
    }
  });
});
