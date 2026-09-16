/**
 * События третьего фронтенда — игры (`game/`, Phaser). Игра никого не
 * авторизует: все её события анонимны (`userId = null`) и идут уже
 * существующим публичным путём `POST /api/public-event` — тем же, что и
 * мини-тесты сайта (правило №5/№14: неверифицированная идентичность не
 * годится для персонального счёта, только для анонимного).
 *
 * Отправитель — `game/src/analytics.ts` (`trackEvent('game_…', meta)`);
 * сверка литералов с этим реестром — `src/security/analytics-sync.invariants.spec.ts`.
 * Отчёт — `src/bot/game-metrics.{service,format}.ts`, блок «Игра» в `/stats`
 * (правило №8).
 *
 * meta — маленький структурный non-PII объект (правило №7): свободного
 * текста в игре нет вовсе, только перечислимые поля ниже.
 */

// Разрешённые имена событий игры (спредятся в ANALYTICS_EVENTS и
// PUBLIC_ANALYTICS_EVENTS — analytics.constants.ts).
export const GAME_EVENTS = [
  'game_open', // открыл страницу игры (meta.src)
  'game_start', // нажал «начать» в меню (без meta)
  'game_tutorial_done', // прошёл обучение (без meta)
  'game_tutorial_skip', // пропустил обучение (без meta)
  'game_chapter_start', // начал главу (meta.chapter)
  'game_chapter_done', // дошёл до конца главы (meta.chapter)
  'game_cta_shown', // увидел приглашение к терапии (meta.from)
  'game_cta_click', // нажал приглашение (meta.from)
  'game_share', // нажал «поделиться» (meta.from)
  'game_over', // экран «сил не осталось» (meta.chapter)
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
//   act1    — развилка после главы 2;
//   cabinet — финал главы 4 (полный прогон);
//   ending  — запасной финал (не добрался до полного прогона).
export const GAME_CTA_PLACES = ['act1', 'cabinet', 'ending'] as const;
export type GameCtaPlace = (typeof GAME_CTA_PLACES)[number];

// Откуда открыли игру (meta.src для game_open):
//   site   — переход с сайта;
//   bot    — переход из бота;
//   share  — по ссылке от друга (см. game_share);
//   direct — открыл без метки в ссылке;
//   other  — метка есть, но незнакомая (рассинхрон/будущее расширение).
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
  if (
    name === 'game_chapter_start' ||
    name === 'game_chapter_done' ||
    name === 'game_over'
  ) {
    const chapter = meta?.chapter;
    return typeof chapter === 'string' && GAME_CHAPTER_SET.has(chapter)
      ? { chapter }
      : null;
  }
  if (
    name === 'game_cta_shown' ||
    name === 'game_cta_click' ||
    name === 'game_share'
  ) {
    const from = meta?.from;
    return typeof from === 'string' && GAME_CTA_PLACE_SET.has(from)
      ? { from }
      : null;
  }
  // game_start / game_tutorial_done / game_tutorial_skip — без meta, любые
  // присланные поля отбрасываются.
  return {};
}
