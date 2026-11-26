import { ctaTargetMeta } from './game-cta.constants';
import { WEEK_CHAPTER_SET, WEEK_CTA_PLACE_SET } from './game-week.constants';

/**
 * События третьего фронтенда — игры (`game/`, Phaser). Игра никого не
 * авторизует: все её события анонимны (`userId = null`) и идут уже
 * существующим публичным путём `POST /api/public-event` — тем же, что и
 * мини-тесты сайта (правило №5/№14: неверифицированная идентичность не
 * годится для персонального счёта, только для анонимного).
 *
 * Отправитель — `game/src/analytics.ts`; сверка литералов —
 * `src/security/analytics-sync.invariants.spec.ts`; отчёт — блок «Игра» в
 * `/stats` (`src/bot/game-metrics.*`, правило №8).
 *
 * meta — маленький структурный non-PII объект (правило №7): свободного
 * текста в игре нет вовсе, только перечислимые поля ниже.
 */

// Имена событий игры (спредятся в (PUBLIC_)ANALYTICS_EVENTS).
export const GAME_EVENTS = [
  'game_open', // открыл страницу игры (meta.src)
  'game_chapter_start', // начал главу (meta.chapter)
  'game_chapter_done', // дошёл до конца главы (meta.chapter)
  'game_cta_shown', // увидел приглашение к терапии (meta.from)
  'game_cta_click', // нажал приглашение (meta.from, meta.to)
  'game_share', // нажал «поделиться» (meta.from)
  'game_app_arrive', // лендинг открыт кнопкой финала (?from=game), без meta
] as const;
export type GameEventName = (typeof GAME_EVENTS)[number];

// Главы игры (meta.chapter) — сюжетный порядок, он же порядок воронки в /stats.
export const GAME_CHAPTERS = [
  'chapter1',
  'chapter2',
  'chapter3',
  'chapter4',
] as const;
export type GameChapter = (typeof GAME_CHAPTERS)[number];

// Место приглашения к терапии (meta.from для game_cta_*/game_share):
//   act1 — развилка после главы 2; cabinet — финал главы 4; ending — запасной.
export const GAME_CTA_PLACES = ['act1', 'cabinet', 'ending'] as const;
export type GameCtaPlace = (typeof GAME_CTA_PLACES)[number];

// Откуда открыли игру (meta.src для game_open): site — с сайта; bot — из бота
// (/game); share — по ссылке друга; direct — без метки; other — незнакомая метка.
export const GAME_ENTRY_SOURCES = [
  'site',
  'bot',
  'share',
  'direct',
  'other',
] as const;
export type GameEntrySource = (typeof GAME_ENTRY_SOURCES)[number];

const GAME_EVENT_SET: ReadonlySet<string> = new Set(GAME_EVENTS);
const GAME_CHAPTER_SET: ReadonlySet<string> = new Set(GAME_CHAPTERS);
const GAME_CTA_PLACE_SET: ReadonlySet<string> = new Set(GAME_CTA_PLACES);
const GAME_ENTRY_SOURCE_SET: ReadonlySet<string> = new Set(GAME_ENTRY_SOURCES);

/** name ∈ GAME_EVENTS — контроллер по этому признаку выбирает санитайзер игры. */
export function isGameEvent(name: string): name is GameEventName {
  return GAME_EVENT_SET.has(name);
}

/**
 * Пропускает ТОЛЬКО известные поля (правило №7 — никакого свободного текста).
 * `chapter`/`from` вне реестра обнуляют мету целиком (событие дропается
 * контроллером): рассинхрон версии клиента виднее как пропавшая строка, чем
 * как мусор в отчёте. `src`, наоборот, никогда не блокирует запись — сам
 * факт открытия важнее метки, поэтому отсутствующий/незнакомый src
 * сворачивается в `'other'`, а не дропает событие.
 */
export function sanitizeGameMeta(
  name: GameEventName,
  meta: Record<string, unknown> | undefined,
): Record<string, unknown> | null {
  if (name === 'game_open') {
    const src = meta?.src;
    return {
      src:
        typeof src === 'string' && GAME_ENTRY_SOURCE_SET.has(src)
          ? src
          : 'other',
    };
  }
  if (name === 'game_chapter_start' || name === 'game_chapter_done') {
    const chapter = meta?.chapter;
    return typeof chapter === 'string' &&
      (GAME_CHAPTER_SET.has(chapter) || WEEK_CHAPTER_SET.has(chapter))
      ? { chapter }
      : null;
  }
  if (
    name === 'game_cta_shown' ||
    name === 'game_cta_click' ||
    name === 'game_share'
  ) {
    const from = meta?.from;
    const known =
      GAME_CTA_PLACE_SET.has(from as string) ||
      WEEK_CTA_PLACE_SET.has(from as string);
    if (typeof from !== 'string' || !known) return null;
    return name === 'game_cta_click'
      ? { from, ...ctaTargetMeta(meta) }
      : { from };
  }
  // Остальные — без meta, присланные поля отбрасываются.
  return {};
}
