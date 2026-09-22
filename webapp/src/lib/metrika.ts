// Единственный модуль, который знает про window.ym (Яндекс.Метрика).
// Остальной код фронтенда обращается к трекингу только через функции этого
// файла, а не через window.ym напрямую — иначе легко повторить баг, из-за
// которого терялся самый первый hit (см. комментарий у ym() ниже).
import { telemetryUrl } from '../utils/telemetryUrl';

export const YM_ID = 109568051;

type YmFn = ((...args: unknown[]) => void) & { a?: unknown[][]; l?: number };

declare global {
  interface Window {
    ym?: YmFn;
  }
}

/**
 * Вставляет тег Яндекс.Метрики и инициализирует счётчик. Идемпотентна —
 * повторный вызов ничего не делает (флаг __ym_loaded).
 */
export function loadMetrika(): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as { __ym_loaded?: boolean; ym?: YmFn };
  if (w.__ym_loaded) return;
  w.__ym_loaded = true;
  w.ym =
    w.ym ||
    function (...args: unknown[]) {
      (w.ym!.a = w.ym!.a || []).push(args);
    };
  w.ym.l = Date.now();
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://mc.yandex.ru/metrika/tag.js?id=${YM_ID}`;
  document.head.appendChild(s);
  w.ym(YM_ID, 'init', {
    webvisor: false, // аудит H2: Webvisor слал бы клинический текст SPA в Яндекс
    clickmap: true,
    accurateTrackBounce: true,
    trackLinks: true,
    defer: true,
  });
}

/**
 * Внутренняя обёртка над window.ym: сначала грузит тег (loadMetrika
 * идемпотентна), потом вызывает счётчик. Вызов ДО загрузки тега попадает в
 * очередь ym.a, а init обязан стоять в этой очереди первым — иначе счётчика
 * ещё нет и событие теряется. Раньше первый hit из App.tsx уходил в
 * window.ym?.(), когда window.ym ещё не существовал, и терялся молча.
 */
function ym(...args: unknown[]): void {
  if (typeof window === 'undefined') return;
  loadMetrika();
  window.ym!(...args);
}

/**
 * Хит страницы (SPA pageview) — вызывается при смене маршрута. Пустой/
 * undefined url (см. analyticsUrl) ничего не шлёт — молча, а не пустой
 * строкой в Метрику.
 */
export function trackHit(url: string | undefined, options?: Record<string, unknown>): void {
  if (!url) return;
  ym(YM_ID, 'hit', url, options);
}

// Рекламные метки, которые Метрике нужны для атрибуции визита: источник
// визита (Директ, кампания) она определяет по URL хита. У счётчика
// defer: true (см. loadMetrika) — автоматического хита при загрузке тега
// нет, есть только наш ручной trackHit, значит если не донести метки в нём,
// реклама вообще не атрибутируется. Совпадение имени параметра — точное
// (Set.has), не подстрока: правило №14 CLAUDE.md — совпадение подстроки
// однажды уже стоило пяти дней сломанного входа
// (docs/archive/INCIDENT_2026-08-08_TELEGRAM_LOGIN.md).
const AD_PARAMS = new Set([
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'yclid', 'ymclid', 'gclid', '_openstat',
]);

/**
 * URL для хита Метрики: путь без секретов (telemetryUrl режет query
 * целиком — там бывают одноразовые OAuth-коды и токены, весь query нести
 * нельзя) плюс рекламные метки из query, если они были в исходном href.
 * Фрагмент (#…) всегда отрезан вместе с telemetryUrl — там тоже секреты.
 */
export function analyticsUrl(href: string | undefined | null): string | undefined {
  const base = telemetryUrl(href);
  if (!base || !href) return base;
  const queryStr = href.split('#')[0].split('?')[1];
  if (!queryStr) return base;
  const kept = new URLSearchParams();
  for (const [key, value] of new URLSearchParams(queryStr)) {
    if (AD_PARAMS.has(key)) kept.append(key, value);
  }
  const keptStr = kept.toString();
  return keptStr ? `${base}?${keptStr}` : base;
}

/** Достижение цели. */
export function trackGoal(name: string, params?: Record<string, unknown>): void {
  ym(YM_ID, 'reachGoal', name, ...(params ? [params] : []));
}

/**
 * Та же цель, но не чаще одного раза за вкладку/сессию — отмечается ключом в
 * sessionStorage. Нужна для целей вроде «начал запись», которые иначе
 * задваивались бы при повторном клике/выборе чипа.
 */
export function trackGoalOnce(name: string, params?: Record<string, unknown>): void {
  const key = `ym_goal_${name}`;
  let alreadySent: boolean;
  try {
    alreadySent = Boolean(sessionStorage.getItem(key));
    if (!alreadySent) sessionStorage.setItem(key, '1');
  } catch {
    // приватный режим: sessionStorage недоступна — дедуп не сработает,
    // цель просто уйдёт снова при повторном вызове.
    alreadySent = false;
  }
  if (!alreadySent) trackGoal(name, params);
}

/** Отправка формы записи: общая цель booking_submit + цель по типу сессии. */
export function trackBookingSubmit(type: 'INTRO_15' | 'SESSION_50'): void {
  trackGoal('booking_submit');
  trackGoal(type === 'SESSION_50' ? 'booking_session' : 'booking_intro');
}
