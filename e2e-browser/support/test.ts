// Общий `test` браузерного смока. Каждый тест идёт через стаб API формы сервера
// (stubApi.ts) и краснеет на падении страницы или раздела. Спек берёт `test`
// отсюда, а не из '@playwright/test': проверку на падение нельзя забыть, а
// свой перехват `/api` с выдуманным ответом — завести. До этого так жили
// public-pages и asset-recovery: под ответом `{}` /articles и /subscribe
// рисовали «Что-то пошло не так», а тест был зелёным (ci-alarm #903, #936).
// Сверку импортов держит src/test-support/gates/browser-smoke-specs.spec.ts.
import { test as base, expect, type Page } from '@playwright/test';
import { stubApi, type StubApiHandle, type StubSession } from './stubApi';

export interface SmokeOptions {
  /**
   * 'client' — вошедший клиент без данных; 'anonymous' — гость публичных
   * страниц (refresh без куки отвечает 401, как AuthController.refresh).
   * Переключается в спеке: `test.use({ session: 'anonymous' })`.
   */
  session: StubSession;
}

export const test = base.extend<SmokeOptions & { api: StubApiHandle }>({
  session: ['client', { option: true }],
  api: [
    async ({ page, session }, use) => {
      const api = await stubApi(page, { session });
      throwOnPageError(page);
      await use(api);
    },
    { auto: true },
  ],
});

export { expect };

/**
 * Ошибки рантайма — то, с чего начинается белый экран у пользователя. Падение,
 * пойманное ErrorBoundary раздела или экраном ошибки роутера, до `pageerror`
 * не доходит: его выдаёт отчёт клиента POST /api/client-errors, и тест
 * краснеет сразу и с причиной, а не таймаутом (ci-alarm #903 полминуты ждал
 * кнопку за «Разделом упал»). Тем же отчётом клиент шлёт фоновые сбои
 * загрузки: на фикстурах формы сервера их быть не должно; появился — ручке не
 * хватает фикстуры (стаб пишет в лог, какой).
 */
export function throwOnPageError(page: Page): void {
  page.on('pageerror', (err) => {
    throw new Error(`Ошибка в рантайме страницы: ${err.message}`);
  });
  page.on('request', (req) => {
    if (req.method() !== 'POST') return;
    if (new URL(req.url()).pathname !== '/api/client-errors') return;
    const report = req.postDataJSON() as { section?: string; message?: string };
    throw new Error(
      `Клиент сообщил о сбое [${report.section}]: ${report.message}`,
    );
  });
}
