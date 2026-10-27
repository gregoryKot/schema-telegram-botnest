import {
  DIARY_QUICK_TAGS,
  HOME_TILES,
} from '../analytics/home-events.constants';
import {
  formatDiaryQuickSaves,
  formatHomeTiles,
  formatTrackerSkips,
  HOME_TILE_LABELS,
} from './home-tiles.format';

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

describe('formatTrackerSkips — «Пропустить» в трекере', () => {
  it('пустая БД: строки нет, в ней нет «0» и NaN', () => {
    expect(formatTrackerSkips(0)).toBeNull();
  });

  it('есть данные: счётчик словами', () => {
    expect(formatTrackerSkips(7)).toBe('Трекер: пропусков 7');
  });
});

describe('formatDiaryQuickSaves — «Дневник одной страницей»', () => {
  const tags = (c: Record<string, number>) =>
    DIARY_QUICK_TAGS.map((tag) => ({ tag, count: c[tag] ?? 0 }));

  it('пустая БД: строки нет, в ней нет «0» и NaN', () => {
    expect(formatDiaryQuickSaves({ byTag: [], detailed: 0 })).toBeNull();
    expect(formatDiaryQuickSaves({ byTag: tags({}), detailed: 0 })).toBeNull();
  });

  it('есть данные: подписи словами, нули не печатаются, «подробно» отдельно', () => {
    const line = formatDiaryQuickSaves({
      byTag: tags({ thought: 5, gratitude: 2, mode: 1 }),
      detailed: 3,
    });
    expect(line).toBe(
      'Дневник одной страницей: мыслей 5, режимов 1, благодарностей 2; подробно 3',
    );
    expect(line).not.toMatch(/thought|mode|gratitude|NaN|undefined/);
  });

  it('без подробных записей хвоста «подробно» нет', () => {
    expect(
      formatDiaryQuickSaves({ byTag: tags({ schema: 4 }), detailed: 0 }),
    ).toBe('Дневник одной страницей: схем 4');
  });
});
