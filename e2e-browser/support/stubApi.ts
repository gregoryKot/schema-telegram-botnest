// Общий стаб бэкенда для авторизованных браузерных смоков (правило «одна
// механика — один компонент», CLAUDE.md). Раньше каждый спек заводил свою
// копию перехвата `**/api/**` — tracker-smoke и crisis-smoke идут через один
// и тот же вход (AuthProvider → /api/auth/refresh) и один и тот же бутстрап
// AppShell, разъезд копий означал бы, что фикс контракта в одной приезжает
// без второй.
//
// AuthProvider монтируется НАД всеми маршрутами (и публичными тоже, см.
// App.tsx: Root), поэтому /api/auth/refresh дёргается на каждой загрузке —
// фейковый токен не мешает тестам, которым авторизация не нужна.
//
// Ответы — форма настоящего контроллера (support/stubFixtures.ts). Ручка без
// фикстуры получает 404, как от сервера на неизвестный маршрут. До ci-alarm
// #903 здесь был «пустой успех» `{}` на всё: экран, ждущий массив, падал в
// смоке на ответе, которого прод не пришлёт, а экран падения роутера с <h1>
// смок принимал за страницу.
import type { Page } from '@playwright/test';
import { localDateStr, todayStr } from '../../shared/src/utils/format';
import { FIXTURES, STATUS, STUB_NEEDS } from './stubFixtures';
import { handleTherapyRoute, type StubTherapyHandle } from './stubTherapy';

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
}

/**
 * Перехватывает `**\/api/**` ответами формы сервера для клиента без данных:
 * вход, профиль, бутстрап AppShell, разделы «Сегодня» и «Практики». Ручка, на
 * которую фикстуры нет, отвечает 404 и пишет предупреждение в лог прогона.
 */
export async function stubApi(page: Page): Promise<StubApiHandle> {
  // CookieBanner — fixed-position оверлей поверх всего приложения, пока нет
  // согласия в localStorage; в реальном браузере это первый тап пользователя,
  // но смок проверяет не его, а кризисный путь/трекер — заранее отвечаем
  // «необходимые куки», чтобы клики не перехватывались баннером. addInitScript
  // выполняется до кода страницы на КАЖДОЙ навигации, включая page.reload().
  await page.addInitScript(() => {
    localStorage.setItem('cookie_consent', 'necessary');
  });

  // Как строки Rating: день — тот, что прислал клиент (сайт всегда шлёт день
  // устройства, shared/src/api/ratingApi.ts). Одно хранилище на запись и оба
  // чтения: /api/ratings отдаёт день, /api/history — дни с оценками.
  const ratingsByDay = new Map<string, Record<string, number>>();
  const therapy: StubTherapyHandle = { connected: false };

  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const key = `${req.method()} ${url.pathname}`;
    const reply = (status: number, body: unknown) =>
      route.fulfill(
        body === null
          ? { status }
          : {
              status,
              contentType: 'application/json',
              body: JSON.stringify(body),
            },
      );

    // Связь с терапевтом — состояние в памяти теста (подключился → отключился).
    if (await handleTherapyRoute(route, therapy)) return;

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
    // Отчёт клиента о сбое (@HttpCode(204)); красным его делает throwOnPageError.
    if (key === 'POST /api/client-errors')
      return route.fulfill({ status: 204 });

    if (key in FIXTURES) {
      const status = STATUS[key] ?? (req.method() === 'POST' ? 201 : 200);
      return reply(status, FIXTURES[key]);
    }
    console.warn(
      `stubApi: нет фикстуры для ${key} — ответ 404, как у сервера на неизвестный маршрут`,
    );
    return reply(404, {
      message: `Cannot ${key}`,
      error: 'Not Found',
      statusCode: 404,
    });
  });

  return { ratingsByDay, therapy };
}

/**
 * Ошибки рантайма — то, с чего начинается белый экран у пользователя. Падение,
 * пойманное ErrorBoundary раздела или экраном ошибки роутера, до `pageerror`
 * не доходит: его выдаёт отчёт клиента POST /api/client-errors, и тест
 * краснеет сразу и с причиной, а не таймаутом (ci-alarm #903 полминуты ждал
 * кнопку за «Разделом упал»). Тем же отчётом клиент шлёт фоновые сбои
 * загрузки: в спеке на stubApi их быть не должно, появился — ручке не хватает
 * фикстуры. У спеков со своим перехватом `/api` этой гарантии нет.
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
