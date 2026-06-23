// Яндекс.Метрика — тот же счётчик, что на сайте. Грузим ТОЛЬКО если юзер
// уже дал согласие на куки на schemehappens.ru (cookie_consent === 'all',
// localStorage общий — игра живёт на том же домене). Без согласия все
// вызовы — тихие no-op.
const YM_ID = 109568051;
let ready = false;

export function initAnalytics() {
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

/** Воронка игры: game_start, tutorial_done/skip, chapter_start/done, game_over */
export function track(goal: string, params?: Record<string, unknown>) {
  if (!ready) return;
  (window as unknown as { ym?: any }).ym?.(YM_ID, 'reachGoal', goal, params);
}
