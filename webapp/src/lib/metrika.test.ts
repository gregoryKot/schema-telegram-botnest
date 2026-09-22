// @vitest-environment jsdom
// lib/metrika — единственный модуль, знающий про window.ym. Проверяем:
// loadMetrika вставляет тег один раз и инициализирует без webvisor; цели
// кладутся в очередь ym.a с init ПЕРВЫМ элементом (иначе цель, ушедшая до
// загрузки тега, теряется — см. комментарий у функции ym() в исходнике);
// trackGoalOnce не задваивает цель за сессию; trackBookingSubmit шлёт
// общую цель booking_submit + цель по типу сессии.
import { describe, it, expect, beforeEach } from 'vitest';
import {
  YM_ID,
  loadMetrika,
  trackHit,
  trackGoal,
  trackGoalOnce,
  trackBookingSubmit,
  analyticsUrl,
} from './metrika';

function ymQueue(): unknown[][] {
  return (window as unknown as { ym?: { a?: unknown[][] } }).ym?.a ?? [];
}

beforeEach(() => {
  delete (window as unknown as { __ym_loaded?: boolean }).__ym_loaded;
  delete (window as unknown as { ym?: unknown }).ym;
  document.querySelectorAll('script[src*="mc.yandex.ru"]').forEach((s) => s.remove());
  sessionStorage.clear();
});

describe('loadMetrika', () => {
  it('вставляет script mc.yandex.ru один раз', () => {
    loadMetrika();
    loadMetrika();
    const scripts = document.querySelectorAll('script[src*="mc.yandex.ru"]');
    expect(scripts.length).toBe(1);
    expect(scripts[0].getAttribute('src')).toBe(`https://mc.yandex.ru/metrika/tag.js?id=${YM_ID}`);
  });

  it('инициализирует счётчик с webvisor: false', () => {
    loadMetrika();
    const initCall = ymQueue().find((c) => c[1] === 'init');
    expect(initCall).toBeTruthy();
    expect((initCall![2] as { webvisor?: boolean }).webvisor).toBe(false);
  });
});

describe('trackGoal', () => {
  it('кладёт [YM_ID, reachGoal, имя] в очередь window.ym.a', () => {
    trackGoal('tg_click');
    const call = ymQueue().find((c) => c[1] === 'reachGoal' && c[2] === 'tg_click');
    expect(call).toEqual([YM_ID, 'reachGoal', 'tg_click']);
  });

  it('с params — params четвёртым элементом', () => {
    trackGoal('booking_intro', { source: 'landing' });
    const call = ymQueue().find((c) => c[1] === 'reachGoal' && c[2] === 'booking_intro');
    expect(call).toEqual([YM_ID, 'reachGoal', 'booking_intro', { source: 'landing' }]);
  });

  it('init стоит первым в очереди — цель до загрузки тега не теряется', () => {
    trackGoal('prices_view');
    const queue = ymQueue();
    expect(queue[0][1]).toBe('init');
    expect(queue.some((c) => c[1] === 'reachGoal' && c[2] === 'prices_view')).toBe(true);
  });
});

describe('trackGoalOnce', () => {
  it('шлёт цель один раз за сессию, второй вызов молчит', () => {
    trackGoalOnce('booking_start');
    trackGoalOnce('booking_start');
    const calls = ymQueue().filter((c) => c[1] === 'reachGoal' && c[2] === 'booking_start');
    expect(calls.length).toBe(1);
  });

  it('после sessionStorage.clear() шлёт цель снова', () => {
    trackGoalOnce('booking_start');
    sessionStorage.clear();
    trackGoalOnce('booking_start');
    const calls = ymQueue().filter((c) => c[1] === 'reachGoal' && c[2] === 'booking_start');
    expect(calls.length).toBe(2);
  });
});

describe('trackBookingSubmit', () => {
  it("SESSION_50 шлёт booking_submit и booking_session", () => {
    trackBookingSubmit('SESSION_50');
    const goals = ymQueue().filter((c) => c[1] === 'reachGoal').map((c) => c[2]);
    expect(goals).toEqual(['booking_submit', 'booking_session']);
  });

  it("INTRO_15 шлёт booking_submit и booking_intro", () => {
    trackBookingSubmit('INTRO_15');
    const goals = ymQueue().filter((c) => c[1] === 'reachGoal').map((c) => c[2]);
    expect(goals).toEqual(['booking_submit', 'booking_intro']);
  });
});

describe('trackHit', () => {
  it('пустой/undefined url ничего не кладёт в очередь', () => {
    trackHit(undefined);
    expect(ymQueue().some((c) => c[1] === 'hit')).toBe(false);
  });
});

// Регрессия: адресную строку в LandingPage починили (search больше не
// срезается), но сам хит Метрики брал telemetryUrl напрямую — тот режет
// query целиком (там бывают секреты вроде ?code=… OAuth), и вместе с
// секретами терялись utm/yclid Директа. analyticsUrl несёт в хит только
// рекламные метки из строгого списка (точное совпадение имени, не
// подстрока — правило №14 CLAUDE.md).
describe('analyticsUrl', () => {
  it('сохраняет utm_source/utm_medium/yclid', () => {
    const url = analyticsUrl('https://kotlarewski.gr/?utm_source=yandex&utm_medium=cpc&yclid=123#booking');
    expect(url).toBe('https://kotlarewski.gr/?utm_source=yandex&utm_medium=cpc&yclid=123');
  });

  it('выкидывает нерекламные параметры, включая секреты (?code=… OAuth)', () => {
    const url = analyticsUrl('https://kotlarewski.gr/?code=secret&utm_source=yandex');
    expect(url).toContain('utm_source=yandex');
    expect(url).not.toContain('code');
    expect(url).not.toContain('secret');
  });

  it('фрагмент (#access_token=…) режется всегда', () => {
    const url = analyticsUrl('https://schemehappens.ru/auth/callback?utm_source=yandex#access_token=live-jwt');
    expect(url).not.toContain('access_token');
    expect(url).not.toContain('live-jwt');
    expect(url).toContain('utm_source=yandex');
  });

  it('без рекламных меток возвращает голый путь без "?"', () => {
    const url = analyticsUrl('https://kotlarewski.gr/?ref=friend&foo=bar');
    expect(url).toBe('https://kotlarewski.gr/');
  });

  it('похожее, но другое имя параметра (utm_sourcex, myclid) не проходит', () => {
    const url = analyticsUrl('https://kotlarewski.gr/?utm_sourcex=yandex&myclid=123');
    expect(url).toBe('https://kotlarewski.gr/');
  });
});
