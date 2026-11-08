// Service worker веб-пушей (`public/sw.js`). Файл в public/ никто не
// импортирует — тест читает его с диска и исполняет с поддельным `self`, как
// это делает браузер (правило №14, образец — maxBridgeLoader.test.ts).
// Проверяет: показ уведомления из payload, битый payload, переход по клику
// только внутри сайта, фокус открытого окна против нового окна, отсутствие fetch.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SOURCE = readFileSync(resolve(__dirname, '../../public/sw.js'), 'utf8');
const ORIGIN = 'https://schemehappens.ru';

type Handler = (event: unknown) => void;

interface FakeWindow {
  focus: ReturnType<typeof vi.fn>;
  navigate?: ReturnType<typeof vi.fn>;
}

function boot(windows: FakeWindow[] = []) {
  const handlers: Record<string, Handler> = {};
  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, fn: Handler) => { handlers[type] = fn; },
    skipWaiting: vi.fn(),
    registration: { showNotification: vi.fn().mockResolvedValue(undefined) },
    clients: {
      claim: vi.fn().mockResolvedValue(undefined),
      matchAll: vi.fn().mockResolvedValue(windows),
      openWindow: vi.fn().mockResolvedValue(null),
    },
  };
  new Function('self', SOURCE)(self);
  return { self, handlers };
}

/** Событие с waitUntil: собирает обещания, чтобы дождаться их в тесте. */
function event<T extends object>(extra: T) {
  const pending: Promise<unknown>[] = [];
  return { ...extra, pending, waitUntil: (p: Promise<unknown>) => { pending.push(p); } };
}

function pushEvent(data: unknown) {
  return event({ data: data === undefined ? null : { json: () => (typeof data === 'string' ? JSON.parse(data) : data) } });
}

async function click(url: unknown, windows: FakeWindow[] = []) {
  const sw = boot(windows);
  const close = vi.fn();
  const e = event({ notification: { close, data: { url } } });
  sw.handlers.notificationclick(e);
  await Promise.all(e.pending);
  return { ...sw, close };
}

describe('sw.js: push', () => {
  it('payload сервера — заголовок, текст, тег, путь в data, иконки сайта', async () => {
    const { self, handlers } = boot();
    const e = pushEvent({ title: 'Трекер ждёт', body: 'Пять потребностей — минута', url: '/today?startapp=tasks_42', tag: 'reminder', silent: true });
    handlers.push(e);
    await Promise.all(e.pending);
    expect(self.registration.showNotification).toHaveBeenCalledWith('Трекер ждёт', {
      body: 'Пять потребностей — минута',
      tag: 'reminder',
      icon: '/icon-192.png',
      badge: '/favicon-96.png',
      data: { url: '/today?startapp=tasks_42' },
      silent: true,
    });
  });

  it.each([
    ['битый JSON', '{"title":'],
    ['пустой push без данных', undefined],
    ['не объект', 42],
  ])('%s — уведомление всё равно есть: «Всё по схеме», без текста, путь /today', async (_name, data) => {
    const { self, handlers } = boot();
    const e = pushEvent(data);
    handlers.push(e);
    await Promise.all(e.pending);
    expect(self.registration.showNotification).toHaveBeenCalledWith('Всё по схеме', {
      icon: '/icon-192.png',
      badge: '/favicon-96.png',
      data: { url: '/today' },
      silent: false,
    });
  });
});

describe('sw.js: клик по уведомлению', () => {
  it('путь сайта, окна нет — открывает новое окно с этим путём, уведомление закрыто', async () => {
    const { self, close } = await click('/today?startapp=tasks_42');
    expect(close).toHaveBeenCalled();
    expect(self.clients.openWindow).toHaveBeenCalledWith(`${ORIGIN}/today?startapp=tasks_42`);
  });

  it.each([
    ['протокол-относительный', '//evil.com/x'],
    ['чужой сайт целиком', 'https://evil.com'],
    ['обратная косая — браузер читает её как /', '/\\evil.com'],
    ['javascript:', 'javascript:alert(1)'],
    ['не строка', 42],
    ['нет пути', undefined],
  ])('%s — переход на /today своего сайта', async (_name, url) => {
    const { self } = await click(url);
    expect(self.clients.openWindow).toHaveBeenCalledWith(`${ORIGIN}/today`);
  });

  it('окно сайта открыто — фокус и переход в нём, нового окна нет', async () => {
    const win: FakeWindow = { focus: vi.fn(), navigate: vi.fn().mockResolvedValue(null) };
    win.focus.mockResolvedValue(win);
    const { self } = await click('/plans', [win]);
    expect(win.focus).toHaveBeenCalled();
    expect(win.navigate).toHaveBeenCalledWith(`${ORIGIN}/plans`);
    expect(self.clients.openWindow).not.toHaveBeenCalled();
  });

  it('окно не под этим воркером (navigate отклонён) — открывается новое', async () => {
    const win: FakeWindow = { focus: vi.fn(), navigate: vi.fn().mockRejectedValue(new TypeError('not controlled')) };
    win.focus.mockResolvedValue(win);
    const { self } = await click('/plans', [win]);
    expect(self.clients.openWindow).toHaveBeenCalledWith(`${ORIGIN}/plans`);
  });

  it('focus() отклонён без активации — переход всё равно делается', async () => {
    const win: FakeWindow = { focus: vi.fn().mockRejectedValue(new Error('no activation')), navigate: vi.fn().mockResolvedValue(null) };
    await click('/plans', [win]);
    expect(win.navigate).toHaveBeenCalledWith(`${ORIGIN}/plans`);
  });
});

describe('sw.js: жизненный цикл и кэш', () => {
  it('install — skipWaiting, activate — clients.claim', async () => {
    const { self, handlers } = boot();
    handlers.install({});
    expect(self.skipWaiting).toHaveBeenCalled();
    const e = event({});
    handlers.activate(e);
    await Promise.all(e.pending);
    expect(self.clients.claim).toHaveBeenCalled();
  });

  it('обработчика fetch нет: приватные данные не попадают в Cache Storage', () => {
    const { handlers } = boot();
    expect(Object.keys(handlers).sort()).toEqual(['activate', 'install', 'notificationclick', 'push']);
    expect(SOURCE).not.toMatch(/caches\./);
  });
});
