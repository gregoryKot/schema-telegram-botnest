// @vitest-environment jsdom
// Отдельный файл: конструирование BASE-адреса завязано на import.meta.env,
// вычисляется один раз при импорте модуля — чтобы проверить обе ветки,
// каждый тест сбрасывает модульный кэш и переимпортирует api.ts со своим
// VITE_API_URL. Смешивать с основным api.test.ts нельзя: там setTokenProvider
// и мок fetch держатся между тестами одного импортированного модуля.
import { describe, it, expect, vi, afterEach } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

function okResponse(): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
  } as unknown as Response;
}

describe('BASE — построение адреса API из VITE_API_URL', () => {
  it('без протокола в переменной окружения — подставляет https://', async () => {
    vi.stubEnv('VITE_API_URL', 'example.com');
    const mod = await import('./api');
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);
    mod.setTokenProvider(() => null);

    await mod.api.getSettings();

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'https://example.com/api/settings',
    );
  });

  it('переменная уже содержит протокол — используется как есть, https:// не дублируется', async () => {
    vi.stubEnv('VITE_API_URL', 'http://localhost:3000');
    const mod = await import('./api');
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);
    mod.setTokenProvider(() => null);

    await mod.api.getSettings();

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'http://localhost:3000/api/settings',
    );
  });

  it('переменная не задана — путь идёт относительным (пустой BASE)', async () => {
    vi.stubEnv('VITE_API_URL', '');
    const mod = await import('./api');
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);
    mod.setTokenProvider(() => null);

    await mod.api.getSettings();

    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/settings');
  });
});
