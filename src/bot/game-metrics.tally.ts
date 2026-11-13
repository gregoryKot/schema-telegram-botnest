import {
  GAME_CHAPTERS,
  GAME_CTA_PLACES,
  GAME_ENTRY_SOURCES,
  type GameChapter,
  type GameCtaPlace,
  type GameEntrySource,
} from '../analytics/game-events.constants';
import {
  GAME_CTA_TARGETS,
  type GameCtaTarget,
} from '../analytics/game-cta.constants';

// Раскладка строк запроса блока «Игра» по граням (src/chapter/place/to) —
// чистая функция; запрос — game-metrics.service.ts, вывод — game-metrics.format.ts.

/** Воронка одной главы: сколько начали, дошли до конца, умерло по дороге. */
export interface GameChapterFunnel {
  chapter: GameChapter;
  started: number;
  finished: number;
  deaths: number;
}

export interface GameMetrics {
  opens: number;
  opensBySource: Record<GameEntrySource, number>;
  starts: number;
  tutorialDone: number;
  tutorialSkipped: number;
  /** Фиксированный порядок GAME_CHAPTERS, всегда 4 записи. */
  chapters: GameChapterFunnel[];
  ctaShown: number;
  ctaClicks: number;
  ctaClicksByPlace: Record<GameCtaPlace, number>;
  /** Клик без `to` (старая версия игры) в разбивку не попадает. */
  ctaClicksByTarget: Record<GameCtaTarget, number>;
  /** Сайт открылся кнопкой финала (?from=game). */
  appArrivals: number;
  shares: number;
}

export interface GameEventRow {
  name: string;
  chapter: string | null;
  place: string | null;
  src: string | null;
  target: string | null;
  c: bigint;
}

type SimpleKey =
  | 'starts'
  | 'tutorialDone'
  | 'tutorialSkipped'
  | 'ctaShown'
  | 'shares'
  | 'appArrivals';

// Счётчики без своей грани — имя события → ключ.
const SIMPLE_COUNTERS: Record<string, SimpleKey> = {
  game_start: 'starts',
  game_tutorial_done: 'tutorialDone',
  game_tutorial_skip: 'tutorialSkipped',
  game_cta_shown: 'ctaShown',
  game_share: 'shares',
  game_app_arrive: 'appArrivals',
};

const zeroRecord = <T extends string>(ids: readonly T[]): Record<T, number> =>
  Object.fromEntries(ids.map((id) => [id, 0])) as Record<T, number>;
const pick = <T extends string>(
  ids: readonly T[],
  v: string | null,
): T | null =>
  v !== null && (ids as readonly string[]).includes(v) ? (v as T) : null;

/** Мусорный src → other; мусорная глава выпадает из воронки; мусорные
 * place/to не идут в разбивку, но считаются в ctaClicks. */
export function tallyGameRows(rows: readonly GameEventRow[]): GameMetrics {
  const byChapter = new Map(
    GAME_CHAPTERS.map((c) => [c, { started: 0, finished: 0, deaths: 0 }]),
  );
  const m: GameMetrics = {
    opens: 0,
    opensBySource: zeroRecord(GAME_ENTRY_SOURCES),
    starts: 0,
    tutorialDone: 0,
    tutorialSkipped: 0,
    chapters: [],
    ctaShown: 0,
    ctaClicks: 0,
    ctaClicksByPlace: zeroRecord(GAME_CTA_PLACES),
    ctaClicksByTarget: zeroRecord(GAME_CTA_TARGETS),
    appArrivals: 0,
    shares: 0,
  };
  for (const row of rows) {
    const c = Number(row.c);
    const simpleKey = SIMPLE_COUNTERS[row.name];
    if (simpleKey) {
      m[simpleKey] += c;
    } else if (row.name === 'game_open') {
      m.opens += c;
      m.opensBySource[pick(GAME_ENTRY_SOURCES, row.src) ?? 'other'] += c;
    } else if (row.name === 'game_cta_click') {
      m.ctaClicks += c;
      const place = pick(GAME_CTA_PLACES, row.place);
      if (place) m.ctaClicksByPlace[place] += c;
      const target = pick(GAME_CTA_TARGETS, row.target);
      if (target) m.ctaClicksByTarget[target] += c;
    } else {
      const chapter = pick(GAME_CHAPTERS, row.chapter);
      const bucket = chapter && byChapter.get(chapter);
      if (!bucket) continue;
      if (row.name === 'game_chapter_start') bucket.started += c;
      else if (row.name === 'game_chapter_done') bucket.finished += c;
      else if (row.name === 'game_over') bucket.deaths += c;
    }
  }
  m.chapters = GAME_CHAPTERS.map((chapter) => ({
    chapter,
    ...byChapter.get(chapter)!,
  }));
  return m;
}
