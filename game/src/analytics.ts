// Две аналитики игры.
//
//  1) Яндекс.Метрика — тот же счётчик, что на сайте. Грузим ТОЛЬКО если юзер
//     уже дал согласие на куки на schemehappens.ru (cookie_consent === 'all',
//     localStorage общий — игра живёт на том же домене). Без согласия все
//     вызовы — тихие no-op. Имена целей (goal) — те, что настроены в кабинете
//     Метрики: не переименовывать.
//  2) Свой бэкенд — POST /api/public-event: анонимно (userId = null), без куки
//     и без личных данных, только имя события и 1–2 поля из allow-list. Ради
//     этого воронка игры видна владельцу в /stats (правило №8 CLAUDE.md).
//     Имена событий — литералы game_*: их сверяет с реестром бэкенда
//     src/security/analytics-sync.invariants.spec.ts, поля meta режет
//     src/analytics/game-events.constants.ts.
const YM_ID = 109568051;
let ready = false;

/** События, которые уезжают на бэкенд (парный реестр — GAME_EVENTS на бэке). */
export type GameEventName =
  | 'game_open' | 'game_start' | 'game_tutorial_done' | 'game_tutorial_skip'
  | 'game_chapter_start' | 'game_chapter_done'
  | 'game_cta_shown' | 'game_cta_click' | 'game_share' | 'game_over';

// Цель Метрики для события бэкенда. Нет записи — событие только для /stats.
const METRIKA_GOAL: Partial<Record<GameEventName, string>> = {
  game_start: 'game_start',
  game_tutorial_done: 'tutorial_done',
  game_tutorial_skip: 'tutorial_skip',
  game_chapter_start: 'chapter_start',
  game_chapter_done: 'chapter_done',
  game_cta_click: 'cta_click',
  game_share: 'cta_share',
  game_over: 'game_over',
};

/** Метки входа, которые ставят ссылки сайта, бота и кнопка «поделиться». */
const ENTRY_SOURCES = ['site', 'bot', 'share'];

export function initAnalytics() {
  initMetrika();
  trackEvent('game_open', { src: entrySource() });
}

function initMetrika() {
  try {
    if (localStorage.getItem('cookie_consent') !== 'all') return;
  } catch { return; }
  const w = window as unknown as { ym?: any; __ym_loaded?: boolean };
  if (w.__ym_loaded) { ready = true; return; }
  w.__ym_loaded = true;
  w.ym = w.ym || function (this: void) { (w.ym.a = w.ym.a || []).push(arguments); };
  w.ym.l = Date.now();
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://mc.yandex.ru/metrika/tag.js?id=${YM_ID}`;
  document.head.appendChild(s);
  w.ym(YM_ID, 'init', { defer: true }); // без webvisor — в игре он не нужен
  w.ym(YM_ID, 'hit', window.location.href);
  ready = true;
}

/** Откуда открыли игру: ?src=site|bot|share; без метки — direct, чужая метка — other. */
function entrySource(): string {
  let src: string | null = null;
  try { src = new URLSearchParams(window.location.search).get('src'); } catch { /* нет location — нет метки */ }
  if (!src) return 'direct';
  return ENTRY_SOURCES.includes(src) ? src : 'other';
}

/** Цель Метрики без записи на бэкенд (excuse_answered, donate_click и т.п.). */
export function track(goal: string, params?: Record<string, unknown>) {
  if (!ready) return;
  (window as unknown as { ym?: any }).ym?.(YM_ID, 'reachGoal', goal, params);
}

/** Событие воронки: на бэкенд всегда, в Метрику — если у него есть цель. */
export function trackEvent(name: GameEventName, meta?: Record<string, unknown>) {
  const goal = METRIKA_GOAL[name];
  if (goal) track(goal, meta);
  // keepalive: клик по CTA открывает новую вкладку, запрос обязан доехать
  // и после ухода со страницы. Аналитика никогда не ломает игру — любая
  // ошибка (нет сети, dev-сервер без бэкенда) глотается.
  try {
    fetch('/api/public-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, meta }),
      keepalive: true,
    }).catch(() => undefined);
  } catch { /* fetch недоступен — игра важнее счётчика */ }
}
