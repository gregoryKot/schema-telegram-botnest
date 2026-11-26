// @vitest-environment jsdom
// @vitest-environment-options {"url": "https://kotlarewski.gr/book"}
// Шов «настоящий адрес визитки → настоящий loadMetrika → флаг webvisor в init»
// (правило №14). security#26: раньше /book, /booking/* получали webvisor:true.
import { describe, it, expect, beforeEach } from 'vitest';
import { loadMetrika, YM_ID } from './metrika';
import { setMetrikaSessionPossible } from './metrikaGate';

function initOptions(): { webvisor: boolean } {
  const queue = (window as unknown as { ym?: { a?: unknown[][] } }).ym?.a ?? [];
  const init = queue.find((c) => c[1] === 'init')!;
  expect(init[0]).toBe(YM_ID);
  return init[2] as { webvisor: boolean };
}

function startAt(path: string): void {
  setMetrikaSessionPossible(false); // MetrikaTracker: анонимный клиент визитки
  delete (window as unknown as { __ym_loaded?: boolean }).__ym_loaded;
  delete (window as unknown as { ym?: unknown }).ym;
  window.history.replaceState(null, '', path);
  loadMetrika();
}

beforeEach(() => {
  expect(window.location.hostname).toBe('kotlarewski.gr');
});

describe('init Метрики на визитке: webvisor решается стартовым путём', () => {
  it.each(['/book', '/booking/paid', '/booking/manage', '/subscribe', '/donate'])(
    '%s → webvisor:false', (path) => {
      startAt(path);
      expect(initOptions().webvisor).toBe(false);
    });

  it.each(['/', '/articles', '/articles/some-slug', '/reviews'])(
    '%s → webvisor:true (контрольный: запись на разрешённых путях жива)', (path) => {
      startAt(path);
      expect(initOptions().webvisor).toBe(true);
    });
});

describe('админка визитки', () => {
  it('/admin → счётчик не стартует вовсе (метрика закрыта на непубличных путях)', () => {
    startAt('/admin');
    const queue = (window as unknown as { ym?: { a?: unknown[][] } }).ym?.a ?? [];
    expect(queue.find((c) => c[1] === 'init')).toBeUndefined();
  });
});
