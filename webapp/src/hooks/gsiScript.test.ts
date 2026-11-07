// @vitest-environment jsdom
// loadGsiScript: скрипт Google вставляется один раз и только по требованию.
// Кэш промиса живёт на уровне модуля — каждый тест сбрасывает модули и
// переимпортирует загрузчик. В jsdom внешние скрипты не грузятся: события load
// и error на теге тест шлёт руками.
import { describe, it, expect, vi, afterEach } from 'vitest';

const SRC = 'https://accounts.google.com/gsi/client';

const tags = () => document.head.querySelectorAll('script#gsi-client');

async function freshLoader() {
  vi.resetModules();
  return (await import('./gsiScript')).loadGsiScript;
}

afterEach(() => {
  delete (window as unknown as { google?: unknown }).google;
  tags().forEach((n) => n.remove());
});

describe('loadGsiScript', () => {
  it('window.google.accounts.id уже есть → true, тег не вставляется', async () => {
    (window as unknown as { google: unknown }).google = {
      accounts: { id: {} },
    };
    const loadGsiScript = await freshLoader();

    await expect(loadGsiScript()).resolves.toBe(true);
    expect(tags()).toHaveLength(0);
  });

  it('два параллельных вызова → один тег с нужным src; load → оба true', async () => {
    const loadGsiScript = await freshLoader();

    const a = loadGsiScript();
    const b = loadGsiScript();

    expect(tags()).toHaveLength(1);
    const tag = tags()[0] as HTMLScriptElement;
    expect(tag.getAttribute('src')).toBe(SRC);
    expect(tag.async).toBe(true);
    tag.dispatchEvent(new Event('load'));
    await expect(Promise.all([a, b])).resolves.toEqual([true, true]);
  });

  it('error → false; следующий вызов вставляет тег заново', async () => {
    const loadGsiScript = await freshLoader();

    const first = loadGsiScript();
    tags()[0].dispatchEvent(new Event('error'));
    await expect(first).resolves.toBe(false);
    expect(tags()).toHaveLength(0);

    const second = loadGsiScript();
    expect(tags()).toHaveLength(1);
    tags()[0].dispatchEvent(new Event('load'));
    await expect(second).resolves.toBe(true);
  });
});
