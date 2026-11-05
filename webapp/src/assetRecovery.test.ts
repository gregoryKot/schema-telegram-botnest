// @vitest-environment jsdom
// Страховка входных файлов сборки (`public/asset-recovery.js`), инцидент
// 2026-11-04: на деплое /donate открылась без стилей — HTML пришёл из одной
// сборки, CSS ушёл в контейнер без этого файла, и повтора не было. Файл лежит
// в public/ и никем не импортируется, поэтому тест читает его с диска и
// исполняет в окне jsdom; сбой загрузки — событие error на элементе, как в
// браузере. Что настоящий Chromium шлёт это событие на собранной странице,
// проверяет e2e-browser/asset-recovery.spec.ts.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SOURCE = readFileSync(
  resolve(__dirname, '../public/asset-recovery.js'),
  'utf8',
);
const INDEX_HTML = readFileSync(resolve(__dirname, '../index.html'), 'utf8');
const REAL_LOCATION = window.location;
const CSS = '/assets/index-AbCdEf12.css';
const JS = '/assets/index-AbCdEf12.js';
const KEY = 'asset-reload-at';
const NOW = Date.UTC(2026, 10, 4, 12, 0, 0);

const reload = vi.fn();
const fetchMock = vi.fn((_url: string, _init: RequestInit) =>
  Promise.resolve(new Response(null, { status: 204 })),
);
let listeners: EventListenerOrEventListenerObject[] = [];

/** Закрыть страницу: её слушатель и теги уходят, sessionStorage остаётся. */
function closePage() {
  for (const fn of listeners) window.removeEventListener('error', fn, true);
  listeners = [];
  document.head.innerHTML = '';
}

/** Новая загрузка страницы по адресу: скрипт исполняется заново, как после перезагрузки. */
function openPage(url = '/donate') {
  closePage();
  history.replaceState(null, '', url);
  Object.defineProperty(window, 'location', {
    value: { ...REAL_LOCATION, reload },
    writable: true,
  });
  const spy = vi.spyOn(window, 'addEventListener');
  new Function(SOURCE)();
  listeners = spy.mock.calls
    .filter(([type]) => type === 'error')
    .map(([, fn]) => fn as EventListenerOrEventListenerObject);
  spy.mockRestore();
  expect(listeners).toHaveLength(1);
}

function add(tag: string, attrs: Record<string, string>) {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs))
    el.setAttribute(name, value);
  document.head.append(el);
  return el;
}
const addStylesheet = (href: string) =>
  add('link', { rel: 'stylesheet', crossorigin: '', href }) as HTMLLinkElement;
const fail = (target: EventTarget) => target.dispatchEvent(new Event('error'));
const failEntryModule = () =>
  fail(add('script', { type: 'module', crossorigin: '', src: JS }));
const reports = () =>
  fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init.body)));
/** Тело отчёта по контракту src/api/dto/client-error.dto.ts; url — только путь. */
const report = (kind: string, path: string) => ({
  source: 'webapp',
  section: 'assets',
  message: `Файл сборки не загрузился: ${kind} ${path}`,
  url: '/donate',
});
const blocked = (): never => {
  throw new DOMException('blocked', 'SecurityError');
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.stubGlobal('fetch', fetchMock);
  sessionStorage.clear();
  reload.mockReset();
  fetchMock.mockClear();
});

afterEach(() => {
  closePage();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('стиль не загрузился', () => {
  it('через 1 с тот же файл запрашивается снова — новым <link> сразу за упавшим', () => {
    openPage();
    const failed = addStylesheet(CSS);
    const next = addStylesheet('/assets/sheet-tasks-Xy12Zw34.css');
    fail(failed);
    vi.advanceTimersByTime(999);
    expect(failed.nextElementSibling).toBe(next);
    vi.advanceTimersByTime(1);
    const retry = failed.nextElementSibling as HTMLLinkElement;
    expect(retry).not.toBe(next);
    expect(retry.rel).toBe('stylesheet');
    expect(retry.href.endsWith(`${CSS}?retry=1`)).toBe(true);
    expect(retry.getAttribute('data-asset-retry')).toBe('1');
    expect(retry.getAttribute('crossorigin')).toBe('');
    expect(retry.nextElementSibling).toBe(next); // порядок каскада прежний
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('пять повторов с паузами 1/2/4/8/16 с, после пятого — один отчёт и без перезагрузки', () => {
    openPage('/donate?x=1#access_token=abc');
    let link = addStylesheet(CSS);
    [1000, 2000, 4000, 8000, 16000].forEach((delay, i) => {
      fail(link);
      vi.advanceTimersByTime(delay - 1);
      expect(link.nextElementSibling).toBeNull();
      vi.advanceTimersByTime(1);
      link = link.nextElementSibling as HTMLLinkElement;
      expect(link.href.endsWith(`${CSS}?retry=${i + 1}`)).toBe(true);
      expect(link.getAttribute('data-asset-retry')).toBe(String(i + 1));
    });
    expect(fetchMock).not.toHaveBeenCalled();
    fail(link);
    vi.advanceTimersByTime(60_000);
    expect(link.nextElementSibling).toBeNull(); // шестого повтора нет
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/client-errors');
    expect(init).toMatchObject({
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
    });
    // Только путь: во фрагменте бывает токен входа (H0).
    expect(reports()).toEqual([report('CSS', CSS)]);
    expect(reload).not.toHaveBeenCalled();
  });

  it('отчёт — один на файл за страницу: другой файл и новая загрузка шлют свой', () => {
    const exhausted = (href: string) =>
      add('link', { rel: 'stylesheet', href, 'data-asset-retry': '5' });
    openPage();
    const last = exhausted(`${CSS}?retry=5`);
    fail(last);
    fail(last);
    fail(exhausted('/assets/sheet-diary-Qw12Er34.css?retry=5'));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    openPage();
    fail(exhausted(`${CSS}?retry=5`));
    expect(reports()).toEqual([
      report('CSS', CSS),
      report('CSS', '/assets/sheet-diary-Qw12Er34.css'),
      report('CSS', CSS),
    ]);
  });

  it('файл игры из /game/assets/ — тоже повторяется', () => {
    openPage();
    const link = addStylesheet('/game/assets/index-Qw12Er34.css');
    fail(link);
    vi.advanceTimersByTime(1000);
    expect((link.nextElementSibling as HTMLLinkElement).href).toMatch(
      /\/game\/assets\/index-Qw12Er34\.css\?retry=1$/,
    );
  });

  it.each([
    ['с чужого хоста', 'https://cdn.example.com/assets/index-AbCdEf12.css'],
    ['не из /assets/', '/fonts/x.css'],
    ['из каталога с похожим именем', '/assets-old/index-AbCdEf12.css'],
  ])('стиль %s — не трогаем', (_name, href) => {
    openPage();
    fail(addStylesheet(href));
    vi.advanceTimersByTime(60_000);
    expect(document.head.children).toHaveLength(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('входной модуль не загрузился', () => {
  it('перезагрузка через 1 с, на следующих загрузках — через 4 и 15 с; четвёртый сбой за 2 минуты — отчёт без перезагрузки', () => {
    [1000, 4000, 15000].forEach((delay, i) => {
      openPage();
      failEntryModule();
      vi.advanceTimersByTime(delay - 1);
      expect(reload).toHaveBeenCalledTimes(i);
      vi.advanceTimersByTime(1);
      expect(reload).toHaveBeenCalledTimes(i + 1);
    });
    expect(JSON.parse(sessionStorage.getItem(KEY)!)).toEqual([
      NOW,
      NOW + 1000,
      NOW + 5000,
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
    openPage('/donate?donation=ok#access_token=abc');
    failEntryModule();
    vi.advanceTimersByTime(60_000);
    expect(reload).toHaveBeenCalledTimes(3);
    expect(reports()).toEqual([report('JS', JS)]);
  });

  it('метки старше 2 минут забываются — перезагрузка снова через 1 с', () => {
    sessionStorage.setItem(
      KEY,
      JSON.stringify([NOW - 300_000, NOW - 180_000, NOW - 120_001]),
    );
    openPage();
    failEntryModule();
    vi.advanceTimersByTime(1000);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(JSON.parse(sessionStorage.getItem(KEY)!)).toEqual([NOW]);
  });

  it('три метки моложе 2 минут — уже без перезагрузки', () => {
    sessionStorage.setItem(
      KEY,
      JSON.stringify([NOW - 119_000, NOW - 60_000, NOW - 1000]),
    );
    openPage();
    failEntryModule();
    vi.advanceTimersByTime(60_000);
    expect(reload).not.toHaveBeenCalled();
    expect(reports()).toEqual([report('JS', JS)]);
  });

  const storageThrows = (method: 'getItem' | 'setItem') => () =>
    vi.spyOn(Storage.prototype, method).mockImplementation(blocked);
  it.each([
    [
      'sessionStorage недоступен',
      () =>
        vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(blocked),
    ],
    ['getItem бросает', storageThrows('getItem')],
    ['setItem бросает', storageThrows('setItem')],
    ['в памяти не JSON', () => sessionStorage.setItem(KEY, 'oops')],
    ['в памяти не массив', () => sessionStorage.setItem(KEY, '{"0":1}')],
    ['в памяти массив не чисел', () => sessionStorage.setItem(KEY, '["1"]')],
  ])(
    '%s — без перезагрузки (цикл не остановить), с отчётом',
    (_name, arrange) => {
      arrange();
      openPage();
      failEntryModule();
      vi.advanceTimersByTime(60_000);
      expect(reload).not.toHaveBeenCalled();
      expect(reports()).toEqual([report('JS', JS)]);
    },
  );
});

describe('остальные сбои — не наши', () => {
  it.each([
    ['обычный <script>', () => add('script', { src: '/assets/x.js' })],
    [
      '<link rel=modulepreload>',
      () => add('link', { rel: 'modulepreload', href: '/assets/x.js' }),
    ],
    ['<img>', () => add('img', { src: '/assets/x.png' })],
    [
      'модуль с чужого хоста',
      () =>
        add('script', { type: 'module', src: `https://cdn.example.com${JS}` }),
    ],
    ['ошибка кода (target — window)', () => window],
  ])('%s — ни повтора, ни перезагрузки, ни отчёта', (_name, make) => {
    openPage();
    fail(make());
    vi.advanceTimersByTime(60_000);
    expect(document.querySelector('[data-asset-retry]')).toBeNull();
    expect(reload).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });
});

describe('index.html', () => {
  it('подключает его синхронно: после theme.js, раньше тегов сборки и модуля приложения', () => {
    const at = INDEX_HTML.indexOf('<script src="/asset-recovery.js"></script>');
    const theme = INDEX_HTML.indexOf('<script src="/theme.js"></script>');
    expect(theme).toBeGreaterThan(-1);
    expect(at).toBeGreaterThan(theme);
    // Vite ставит теги сборки в конец <head>: раньше </head> — значит, раньше них.
    expect(at).toBeLessThan(INDEX_HTML.indexOf('</head>'));
    expect(at).toBeLessThan(
      INDEX_HTML.indexOf('<script type="module" src="/src/main.tsx">'),
    );
    const firstStylesheet = INDEX_HTML.search(/<link[^>]*rel="stylesheet"/);
    expect(firstStylesheet === -1 || firstStylesheet > at).toBe(true);
    // Ровно один тег и без async/defer/type: иначе слушатель опоздает к ошибкам.
    expect(INDEX_HTML.match(/<script[^>]*asset-recovery\.js[^>]*>/g)).toEqual([
      '<script src="/asset-recovery.js">',
    ]);
  });
});
