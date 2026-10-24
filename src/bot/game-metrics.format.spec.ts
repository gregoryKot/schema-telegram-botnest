// Блок «Игра» в /stats.
//
// Пустое состояние проверяется первым и намеренно: на чистой базе отчёт не
// должен показывать «0/NaN/мусор» — правило №8 требует именно этого.
import { formatGameMetrics, type GameMetrics } from './game-metrics.format';
import {
  GAME_CHAPTERS,
  GAME_CTA_PLACES,
  GAME_ENTRY_SOURCES,
} from '../analytics/game-events.constants';

const emptySources = () =>
  Object.fromEntries(
    GAME_ENTRY_SOURCES.map((s) => [s, 0]),
  ) as GameMetrics['opensBySource'];

const emptyPlaces = () =>
  Object.fromEntries(
    GAME_CTA_PLACES.map((p) => [p, 0]),
  ) as GameMetrics['ctaClicksByPlace'];

const emptyChapters = () =>
  GAME_CHAPTERS.map((chapter) => ({
    chapter,
    started: 0,
    finished: 0,
    deaths: 0,
  }));

const EMPTY: GameMetrics = {
  opens: 0,
  opensBySource: emptySources(),
  starts: 0,
  tutorialDone: 0,
  tutorialSkipped: 0,
  chapters: emptyChapters(),
  ctaShown: 0,
  ctaClicks: 0,
  ctaClicksByPlace: emptyPlaces(),
  shares: 0,
};

describe('пустая база', () => {
  it('говорит словами, что игру не открывали, без цифр и NaN', () => {
    const out = formatGameMetrics(EMPTY);

    expect(out).toBe('🎮 <b>Игра</b>: за 30 дней никто не открывал.');
    expect(out).not.toMatch(/\b0\b/);
    expect(out).not.toContain('NaN');
    expect(out).not.toContain('undefined');
  });
});

describe('полный отчёт', () => {
  const FULL: GameMetrics = {
    opens: 120,
    opensBySource: { site: 80, bot: 20, share: 10, direct: 5, other: 5 },
    starts: 100,
    tutorialDone: 70,
    tutorialSkipped: 30,
    chapters: [
      { chapter: 'chapter1', started: 90, finished: 60, deaths: 20 },
      { chapter: 'chapter2', started: 55, finished: 30, deaths: 70 },
      { chapter: 'chapter3', started: 20, finished: 10, deaths: 5 },
      { chapter: 'chapter4', started: 5, finished: 3, deaths: 0 },
    ],
    ctaShown: 40,
    ctaClicks: 15,
    ctaClicksByPlace: { act1: 10, cabinet: 5, ending: 0 },
    shares: 8,
  };

  it('показывает открытия с разбивкой по источникам', () => {
    const out = formatGameMetrics(FULL);
    expect(out).toContain(
      'Открыли: 120 — с сайта 80, из бота 20, по ссылке от друга 10, напрямую 5, с незнакомой меткой 5',
    );
  });

  it('показывает старты и воронку обучения', () => {
    const out = formatGameMetrics(FULL);
    expect(out).toContain(
      'Нажали «начать»: 100 · обучение прошли 70, пропустили 30',
    );
  });

  it('показывает воронку по каждой начатой главе', () => {
    const out = formatGameMetrics(FULL);
    expect(out).toContain('• Глава 1: 90 → 60 · 20 раз');
    expect(out).toContain('• Глава 2: 55 → 30 · 70 раз');
    expect(out).toContain('• Глава 4: 5 → 3 · 0 раз');
  });

  it('показывает приглашение к терапии с разбивкой по местам (нулевое место не перечисляется)', () => {
    const out = formatGameMetrics(FULL);
    expect(out).toContain(
      'Приглашение к терапии: увидели 40, нажали 15 (после первой части 10, в кабинете 5)',
    );
    expect(out).not.toContain('в запасном финале');
  });

  it('показывает шаринг', () => {
    expect(formatGameMetrics(FULL)).toContain('Поделились игрой: 8');
  });
});

describe('частичный отчёт', () => {
  it('только opens: нет строк про начало игры, главы, приглашение или шаринг', () => {
    const out = formatGameMetrics({
      ...EMPTY,
      opens: 10,
      opensBySource: { ...emptySources(), site: 10 },
    });

    expect(out).toContain('Открыли: 10 — с сайта 10');
    expect(out).not.toContain('Нажали «начать»');
    expect(out).not.toContain('Главы (');
    expect(out).not.toContain('Приглашение к терапии');
    expect(out).not.toContain('Поделились');
  });

  it('нулевые источники открытия не перечисляются', () => {
    const out = formatGameMetrics({
      ...EMPTY,
      opens: 3,
      opensBySource: { ...emptySources(), bot: 3 },
    });

    expect(out).toContain('Открыли: 3 — из бота 3');
    expect(out).not.toContain('с сайта');
    expect(out).not.toContain('по ссылке от друга');
  });

  it('глава без стартов не печатается, даже если у неё есть finished/deaths', () => {
    const chapters = emptyChapters();
    chapters[1] = { chapter: 'chapter2', started: 0, finished: 0, deaths: 3 };
    const out = formatGameMetrics({ ...EMPTY, opens: 1, chapters });

    // deaths без стартов — историческая аномалия (глава открылась старой
    // версией клиента), started === 0 у всех — весь блок «Главы» пропущен.
    expect(out).not.toContain('Главы (');
  });

  it('нажали «начать» без прохождения/пропуска обучения — без суффикса про обучение', () => {
    const out = formatGameMetrics({ ...EMPTY, starts: 5 });
    expect(out).toContain('Нажали «начать»: 5');
    expect(out).not.toContain('обучение');
  });
});
