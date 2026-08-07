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
};

const EMPTY: ScreenMetrics = { opensByScreen: [], hiddenByScreenBlock: [] };

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
      opensByScreen: [{ screen: 'patterns', count: 5 }],
      hiddenByScreenBlock: [],
    });
    expect(text).toContain('Паттерны: открывали 5 раз');
    expect(text).not.toContain('скрывают');
  });

  it('прятали блок, но открытие экрана не зафиксировано — без «открывали»', () => {
    const text = formatScreenMetrics({
      opensByScreen: [],
      hiddenByScreenBlock: [{ screen: 'profile', block: 'insights', count: 2 }],
    });
    expect(text).toContain('Профиль: скрывают: Наблюдения — 2');
    expect(text).not.toContain('открывали');
  });

  it('экран без данных вообще не попадает в отчёт', () => {
    const text = formatScreenMetrics({
      opensByScreen: [{ screen: 'profile', count: 4 }],
      hiddenByScreenBlock: [],
    });
    expect(text).not.toContain('Паттерны');
  });

  it('неизвестный screen/block не роняет отчёт — печатается как есть', () => {
    const text = formatScreenMetrics({
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
