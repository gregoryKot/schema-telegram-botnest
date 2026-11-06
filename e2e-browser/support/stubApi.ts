// Общий стаб бэкенда браузерного смока (правило «одна механика — один
// компонент», CLAUDE.md): спеки получают его через общий `test` (test.ts), а
// не заводят свой перехват `**/api/**` — разъезд копий означал бы, что фикс
// контракта в одной приезжает без второй.
//
// AuthProvider монтируется НАД всеми маршрутами (App.tsx: Root), поэтому
// /api/auth/refresh дёргается на каждой загрузке: вошедший клиент получает
// токен, гость ('anonymous') — 401, как от AuthController.refresh без куки.
//
// Ответы — форма настоящего контроллера (support/stubFixtures.ts). Ручка без
// фикстуры получает 404, как от сервера на неизвестный маршрут. До ci-alarm
// #903 здесь был «пустой успех» `{}` на всё: экран, ждущий массив, падал в
// смоке на ответе, которого прод не пришлёт, а экран падения роутера с <h1>
// смок принимал за страницу.
import type { Page } from '@playwright/test';
import { localDateStr, todayStr } from '../../shared/src/utils/format';
import { FIXTURES, STATUS, STUB_NEEDS } from './stubFixtures';
import { handlePublicRoute } from './stubPublic';
import { handleTherapyRoute, type StubTherapyHandle } from './stubTherapy';

export type StubSession = 'client' | 'anonymous';

export interface StubApiHandle {
  /**
   * Оценки по дням (YYYY-MM-DD → needId → значение) живут в памяти теста, а
   * не в фикстуре-константе: сохранение должно реально доехать до «сервера»
   * и вернуться при следующем чтении — иначе проверка «пережило
   * перезагрузку» была бы самообманом.
   */
  ratingsByDay: Map<string, Record<string, number>>;
  /** Связь с терапевтом (stubTherapy.ts): состояние «подключён» живёт здесь. */
  therapy: StubTherapyHandle;
  /** Ответ ручке для одного теста поверх FIXTURES чистого клиента (та же
   *  форма сервера, данные, которых у чистого аккаунта нет): ключ как в FIXTURES. */
  overrides: Map<string, unknown>;
}

/**
 * Перехватывает `**\/api/**` ответами формы сервера для клиента без данных
 * (или гостя): вход, профиль, бутстрап AppShell, разделы, публичные страницы.
 * Ручка без фикстуры отвечает 404 и пишет предупреждение в лог прогона.
 */
export async function stubApi(
  page: Page,
  { session = 'client' }: { session?: StubSession } = {},
): Promise<StubApiHandle> {
  // CookieBanner — fixed-position оверлей поверх всего приложения, пока нет
  // согласия в localStorage; в реальном браузере это первый тап пользователя,
  // но смок проверяет не его, а кризисный путь/трекер — заранее отвечаем
  // «необходимые куки», чтобы клики не перехватывались баннером. addInitScript
  // выполняется до кода страницы на КАЖДОЙ навигации, включая page.reload().
  await page.addInitScript(() => {
    try {
      localStorage.setItem('cookie_consent', 'necessary');
    } catch {
      // about:blank до первой навигации: у документа нет хранилища.
    }
  });

  // Как строки Rating: день — тот, что прислал клиент (сайт всегда шлёт день
  // устройства, shared/src/api/ratingApi.ts). Одно хранилище на запись и оба
  // чтения: /api/ratings отдаёт день, /api/history — дни с оценками.
  const ratingsByDay = new Map<string, Record<string, number>>();
  const therapy: StubTherapyHandle = { connected: false };
  const overrides = new Map<string, unknown>();

  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const key = `${req.method()} ${url.pathname}`;
    const reply = (status: number, body: unknown) =>
      body === null
        ? route.fulfill({ status })
        : route.fulfill({
            status,
            contentType: 'application/json',
            body: JSON.stringify(body),
          });
    // Тело ошибки Nest (HttpException): { message, error, statusCode }.
    const nestError = (statusCode: number, error: string, message: string) =>
      reply(statusCode, { message, error, statusCode });

    if (session === 'anonymous' && key === 'POST /api/auth/refresh')
      return nestError(401, 'Unauthorized', 'No refresh token');
    // Связь с терапевтом — состояние в памяти теста (подключился → отключился).
    if (await handleTherapyRoute(route, therapy)) return;
    if (await handlePublicRoute(key, url, reply)) return;

    // Без даты сервер берёт сегодняшний день пользователя; у стаба
    // пользователь — браузер на этой же машине, его день — todayStr().
    if (key === 'GET /api/ratings') {
      const day = url.searchParams.get('date') ?? todayStr();
      return reply(200, ratingsByDay.get(day) ?? {});
    }
    if (key === 'POST /api/rating') {
      const body = req.postDataJSON() as {
        needId: string;
        value: number;
        date?: string;
      };
      const date = body.date ?? todayStr();
      const day = { ...ratingsByDay.get(date), [body.needId]: body.value };
      ratingsByDay.set(date, day);
      const allDone =
        date === todayStr() && Object.keys(day).length === STUB_NEEDS.length;
      return reply(201, { ok: true, allDone });
    }
    // src/bot/bot.rating-history.ts getHistoryRatings: дни окна `days`
    // (по умолчанию 7), только с оценками, свежие первыми.
    if (key === 'GET /api/history') {
      const from = new Date();
      from.setDate(
        from.getDate() - (Number(url.searchParams.get('days') ?? 7) - 1),
      );
      const since = localDateStr(from);
      const days = [...ratingsByDay]
        .filter(([date]) => date >= since)
        .sort(([a], [b]) => b.localeCompare(a));
      return reply(
        200,
        days.map(([date, ratings]) => ({ date, ratings })),
      );
    }
    // Отчёт клиента о сбое (@HttpCode(204)); красным его делает throwOnPageError (test.ts).
    if (key === 'POST /api/client-errors')
      return route.fulfill({ status: 204 });

    if (overrides.has(key)) return reply(200, overrides.get(key));
    if (key in FIXTURES) {
      const status = STATUS[key] ?? (req.method() === 'POST' ? 201 : 200);
      return reply(status, FIXTURES[key]);
    }
    console.warn(
      `stubApi: нет фикстуры для ${key} — ответ 404, как у сервера на неизвестный маршрут`,
    );
    return nestError(404, 'Not Found', `Cannot ${key}`);
  });

  return { ratingsByDay, therapy, overrides };
}
