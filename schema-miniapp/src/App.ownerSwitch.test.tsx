// @vitest-environment jsdom
// Тест на шве (правило №14) для E-1, аудит 2026-10, находка frontends#9.
//
// Защита E-1 сверяет владельца локальных данных по `sub` токена, то есть после
// обмена подписи на сессию. Но офлайн-очередь оценок уходила на маунте App по
// initData нового пользователя B, ещё до обмена: оценки аккаунта A доставлялись
// в аккаунт B. Здесь НАСТОЯЩИЕ main.tsx, App.tsx, session.ts, sessionRenew.ts,
// apiClient.ts, api.ts, очередь из shared и telegram-хост с подписью B; подменены
// только тяжёлые секции и fetch. Общий App.test-fixtures.ts сюда не годится:
// он мокает `../session` целиком, то есть ровно тот шов, который проверяем.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, waitFor, act } from '@testing-library/react';

vi.mock('./components/AppSections', () => ({
  AppSections: () => <div data-testid="app-sections" />,
}));
vi.mock('./components/AppOverlays', () => ({ AppOverlays: () => null }));
vi.mock('./components/TherapistClientSheet', () => ({
  TherapistClientSheet: () => null,
}));
vi.mock('./components/TrackerHistoryOverlay', () => ({
  TrackerHistoryOverlay: () => null,
}));

import { clearSession } from './session';
import { clearApiCache } from '../../shared/src/api/apiCache';
import { DATA_OWNER_KEY } from '../../shared/src/auth/dataOwnerGuard';
import { HOST_OWNER_KEY } from '../../shared/src/auth/hostOwnerGuard';

const INIT_DATA_B = 'user=%7B%22id%22%3A222%7D&auth_date=1&hash=bbbb';
const OUTBOX_KEY = 'rating_outbox_v1';
const jwtFor = (sub: string) =>
  `h.${btoa(JSON.stringify({ sub })).replace(/=+$/, '')}.s`;
const PROFILE = {
  role: 'CLIENT',
  name: null,
  ysq: { completedAt: null, activeSchemaIds: [] },
  notifications: {
    enabled: false,
    reminderEnabled: false,
    timezone: 'Europe/Moscow',
    localHour: 21,
  },
  streak: 0,
  lastActivity: {
    needsTracker: null,
    schemaDiary: null,
    modeDiary: null,
    gratitudeDiary: null,
  },
  mySchemaIds: [],
  myModeIds: [],
};
const SETTINGS = {
  notifyEnabled: false,
  notifyLocalHour: 21,
  notifyTimezone: 'Europe/Moscow',
  notifyReminderEnabled: false,
  addressForm: 'ty',
  pairCardDismissed: false,
  mySchemaIds: [],
  myModeIds: [],
  therapistShareCards: false,
  therapistShareProfile: false,
};
const A_RATING = [{ needId: 'safety', value: 9, date: '2026-10-10' }];

type Call = { url: string; method: string; body?: string; snapshot: Snap };
type Snap = { queue: string | null; therapist: string | null };
let calls: Call[] = [];
let releaseExchange: () => void = () => {};
let tokenSub = '222';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
const ratingPosts = () =>
  calls.filter((c) => c.url.endsWith('/api/rating') && c.method === 'POST');
const exchangeIdx = () =>
  calls.findIndex((c) => c.url.endsWith('/api/auth/telegram/webapp'));

function fakeFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const url = String(input);
  const method = init.method ?? 'GET';
  calls.push({
    url,
    method,
    body: typeof init.body === 'string' ? init.body : undefined,
    snapshot: {
      queue: localStorage.getItem(OUTBOX_KEY),
      therapist: localStorage.getItem('therapist_mode'),
    },
  });
  if (url.endsWith('/api/auth/refresh'))
    return Promise.resolve(json({ message: 'No refresh token' }, 401));
  if (url.endsWith('/api/auth/telegram/webapp')) {
    // Обмен подписи отвечает с задержкой, как сеть: резолвится из теста.
    return new Promise((resolve) => {
      releaseExchange = () =>
        resolve(json({ accessToken: jwtFor(tokenSub), expiresIn: 900 }));
    });
  }
  if (url.endsWith('/api/rating') && method === 'POST')
    return Promise.resolve(json({ ok: true, allDone: false }));
  if (/\/api\/pair/.test(url))
    return Promise.resolve(json({ partners: [], pendingCode: null }));
  if (/\/api\/profile/.test(url)) return Promise.resolve(json(PROFILE));
  if (/\/api\/settings/.test(url)) return Promise.resolve(json(SETTINGS));
  if (/disclaimer/.test(url)) return Promise.resolve(json({ accepted: true }));
  if (/needs|history|practices|tasks|plans/.test(url))
    return Promise.resolve(json([]));
  return Promise.resolve(json({}));
}

/** Запуск как в проде: настоящий main.tsx монтирует App в #root. */
async function launchApp() {
  document.body.innerHTML = '<div id="root"></div>';
  await act(async () => {
    await import('./main');
  });
}

beforeEach(() => {
  calls = [];
  tokenSub = '222';
  localStorage.clear();
  sessionStorage.clear();
  clearSession();
  clearApiCache();
  vi.resetModules();
  (window as unknown as { Telegram?: unknown }).Telegram = {
    WebApp: {
      initData: INIT_DATA_B,
      initDataUnsafe: { user: { id: 222, first_name: 'B' } },
      ready: () => {},
      expand: () => {},
    },
  };
  vi.stubGlobal('fetch', vi.fn(fakeFetch));
  window.history.pushState({}, '', '/');
});

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  delete (window as unknown as { Telegram?: unknown }).Telegram;
});

describe('E-1: очередь оценок прежнего аккаунта и вход нового (мини-апп)', () => {
  it('очередь A не уходит до обмена подписи и не уходит после — стирается сверкой владельца', async () => {
    localStorage.setItem(DATA_OWNER_KEY, '111');
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(A_RATING));

    await launchApp();
    await waitFor(() => expect(exchangeIdx()).toBeGreaterThan(-1));
    // Обмен ещё не отвечен: личность B не подтверждена, записи уходить нельзя.
    expect(ratingPosts()).toHaveLength(0);

    await act(async () => releaseExchange());
    await waitFor(() =>
      expect(localStorage.getItem(DATA_OWNER_KEY)).toBe('222'),
    );
    expect(localStorage.getItem(OUTBOX_KEY)).toBeNull();
    // Дать флашу шанс (если бы он ещё был): ни одной оценки A под аккаунтом B.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(ratingPosts()).toHaveLength(0);
  });

  it('контроль: тот же владелец → его очередь доставляется, и только после обмена', async () => {
    localStorage.setItem(DATA_OWNER_KEY, '222');
    localStorage.setItem(
      OUTBOX_KEY,
      JSON.stringify([{ needId: 'rest', value: 4, date: '2026-10-11' }]),
    );

    await launchApp();
    await waitFor(() => expect(exchangeIdx()).toBeGreaterThan(-1));
    expect(ratingPosts()).toHaveLength(0);

    await act(async () => releaseExchange());
    // StrictMode в main.tsx удваивает эффект старта: повтор идемпотентен
    // (upsert), важно, что уходит оценка B и ничья больше.
    await waitFor(() => expect(ratingPosts().length).toBeGreaterThan(0));
    for (const p of ratingPosts()) expect(p.body).toContain('"needId":"rest"');
    expect(calls.indexOf(ratingPosts()[0])).toBeGreaterThan(exchangeIdx());
    await waitFor(() => expect(localStorage.getItem(OUTBOX_KEY)).toBeNull());
  });

  it('запомненный владелец площадки ≠ вошедшему → локальные данные чисты ещё до первого запроса', async () => {
    localStorage.setItem(HOST_OWNER_KEY, 'telegram:111');
    localStorage.setItem(DATA_OWNER_KEY, '111');
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(A_RATING));
    localStorage.setItem('therapist_mode', '1');

    await launchApp();
    await waitFor(() => expect(calls.length).toBeGreaterThan(0));
    // Ни один из стартовых запросов не видел чужих данных.
    // (кабинет терапевта A: App сам пишет '0' после профиля, значит — не '1').
    for (const c of calls) {
      expect(c.snapshot.queue).toBeNull();
      expect(c.snapshot.therapist).not.toBe('1');
    }
    expect(localStorage.getItem('therapist_mode')).not.toBe('1');
    await act(async () => releaseExchange());
    await waitFor(() =>
      expect(localStorage.getItem(HOST_OWNER_KEY)).toBe('telegram:222'),
    );
    expect(ratingPosts()).toHaveLength(0);
  });
});
