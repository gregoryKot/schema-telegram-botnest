// Форматтер блока «Настройка экранов»: полные данные, пустая БД (без NaN и
// голых ключей), подписи экранов/блоков без словаря и сверка с реестрами
// CUSTOMIZABLE_SCREENS/SCREEN_BLOCK_IDS — новый id без подписи вылез бы в
// отчёт голым ключом.
import {
  formatScreenMetrics,
  SCREEN_LABELS,
  SCREEN_BLOCK_LABELS,
  ScreenMetrics,
} from './screen-metrics.format';
import {
  CUSTOMIZABLE_SCREENS,
  SCREEN_BLOCK_IDS,
} from '../analytics/analytics.constants';

const FULL: ScreenMetrics = {
  opensByScreen: [
    { screen: 'profile', count: 12 },
    { screen: 'patterns', count: 3 },
  ],
  hiddenByScreenBlock: [
    { screen: 'profile', block: 'streak', count: 3 },
    { screen: 'profile', block: 'heatmap', count: 1 },
  ],
  movesByScreen: [],
  syncedUsers: 0,
};

const EMPTY: ScreenMetrics = {
  opensByScreen: [],
  hiddenByScreenBlock: [],
  movesByScreen: [],
  syncedUsers: 0,
};

describe('formatScreenMetrics', () => {
  it('пустая БД: ровно одна строка, без NaN и без словарного мусора', () => {
    const text = formatScreenMetrics(EMPTY);
    expect(text).toBe('🧩 Настройку экранов пока не трогали.');
    expect(text).not.toMatch(/NaN|undefined/);
  });

  it('полные данные: открытия и скрытия человеческими подписями', () => {
    const text = formatScreenMetrics(FULL);
    expect(text).toContain(
      'Профиль: открывали 12 раз; скрывают: Серия — 3 · Календарь активности — 1',
    );
    expect(text).toContain('Паттерны: открывали 3 раз');
    // Язык отчёта — без внутренних id (правило №8).
    expect(text).not.toMatch(/profile|patterns|streak|heatmap/);
  });

  it('экран открывали, но ничего не прятали — без «скрывают»', () => {
    const text = formatScreenMetrics({
      ...EMPTY,
      opensByScreen: [{ screen: 'patterns', count: 5 }],
    });
    expect(text).toContain('Паттерны: открывали 5 раз');
    expect(text).not.toContain('скрывают');
  });

  it('прятали блок, но открытие экрана не зафиксировано — без «открывали»', () => {
    const text = formatScreenMetrics({
      ...EMPTY,
      hiddenByScreenBlock: [{ screen: 'profile', block: 'insights', count: 2 }],
    });
    expect(text).toContain('Профиль: скрывают: Наблюдения — 2');
    expect(text).not.toContain('открывали');
  });

  it('экран без данных вообще не попадает в отчёт', () => {
    const text = formatScreenMetrics({
      ...EMPTY,
      opensByScreen: [{ screen: 'profile', count: 4 }],
    });
    expect(text).not.toContain('Паттерны');
  });

  it('неизвестный screen/block не роняет отчёт — печатается как есть', () => {
    const text = formatScreenMetrics({
      ...EMPTY,
      opensByScreen: [{ screen: 'новый_экран', count: 1 }],
      hiddenByScreenBlock: [
        { screen: 'profile', block: 'новый_блок', count: 1 },
      ],
    });
    expect(text).toContain('новый_экран: открывали 1 раз');
    expect(text).toContain('новый_блок — 1');
  });

  it('у каждого экрана из CUSTOMIZABLE_SCREENS есть человеческая подпись', () => {
    for (const screen of CUSTOMIZABLE_SCREENS) {
      expect(SCREEN_LABELS[screen]).toBeTruthy();
    }
  });

  it('у каждого блока из SCREEN_BLOCK_IDS есть человеческая подпись', () => {
    for (const block of SCREEN_BLOCK_IDS) {
      expect(SCREEN_BLOCK_LABELS[block]).toBeTruthy();
    }
  });
});

describe('formatScreenMetrics — movesByScreen (переставляли блоки)', () => {
  it('перестановок нет — строка не показывается вовсе (пустое состояние блока не меняем)', () => {
    const text = formatScreenMetrics({ ...EMPTY, movesByScreen: [] });
    expect(text).toBe('🧩 Настройку экранов пока не трогали.');
    expect(text).not.toMatch(/переставля/i);
  });

  it('перестановки на нескольких экранах — подписи в порядке настройки, до syncedUsers', () => {
    const text = formatScreenMetrics({
      ...FULL,
      // Вход нарочно не в порядке SCREENS_ORDER — форматтер пересортирует.
      movesByScreen: [
        { screen: 'today', count: 2 },
        { screen: 'profile', count: 6 },
      ],
      syncedUsers: 7,
    });
    const lines = text.split('\n');
    const moveLine = 'Переставляют блоки: Профиль — 6 · Сегодня — 2';
    expect(lines).toContain(moveLine);
    expect(lines.indexOf(moveLine)).toBeLessThan(
      lines.indexOf('Настройки синхронизированы: 7 человек'),
    );
    expect(lines.at(-1)).toBe('Настройки синхронизированы: 7 человек');
  });

  it('экран с нулём перестановок в строку не попадает', () => {
    const text = formatScreenMetrics({
      ...EMPTY,
      movesByScreen: [
        { screen: 'patterns', count: 0 },
        { screen: 'today', count: 3 },
      ],
    });
    expect(text).toBe(
      '🧩 Настройку экранов пока не трогали.\nПереставляют блоки: Сегодня — 3',
    );
    expect(text).not.toMatch(/NaN|undefined|Паттерны/);
  });

  it('неизвестный экран в перестановках не роняет отчёт — печатается как есть', () => {
    const text = formatScreenMetrics({
      ...EMPTY,
      movesByScreen: [{ screen: 'новый_экран', count: 1 }],
    });
    expect(text).toContain('Переставляют блоки: новый_экран — 1');
  });
});

describe('formatScreenMetrics — syncedUsers (серверное зеркало настроек)', () => {
  it('syncedUsers = 0 — строка не показывается вовсе (пустое состояние блока не меняем)', () => {
    const text = formatScreenMetrics({ ...EMPTY, syncedUsers: 0 });
    expect(text).toBe('🧩 Настройку экранов пока не трогали.');
    expect(text).not.toMatch(/синхронизир/);
  });

  it('syncedUsers > 0 при полных данных — строка добавляется последней', () => {
    const text = formatScreenMetrics({ ...FULL, syncedUsers: 7 });
    expect(text.split('\n').at(-1)).toBe(
      'Настройки синхронизированы: 7 человек',
    );
  });

  it('syncedUsers > 0, но открытий/скрытий за месяц не было — фиксированное «не трогали» плюс строка синхронизации', () => {
    const text = formatScreenMetrics({ ...EMPTY, syncedUsers: 5 });
    expect(text).toBe(
      '🧩 Настройку экранов пока не трогали.\nНастройки синхронизированы: 5 человек',
    );
    expect(text).not.toMatch(/NaN|undefined/);
  });
});
