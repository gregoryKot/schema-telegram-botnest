// Общий стаб бэкенда + вход хоста Telegram для miniapp-smoke.spec.ts.
//
// Отдельный файл от support/stubApi.ts (webapp): бутстрап AppShell мини-аппа
// дёргает другой набор эндпоинтов (diary/schema, diary/mode, diary/gratitude,
// pair, user-flags, therapy/relation — их нет в webapp-стабе) и другой вход
// (initData через настоящий telegram-web-app.js, а не JWT/refresh-кука).
// «Одна механика — один компонент» здесь не нарушается: механика стаба та
// же (page.route('**/api/**') + фикстуры), но набор фикстур — часть контракта
// конкретного фронта, копировать webapp-стаб один в один означало бы либо
// дублировать чужие эндпоинты, либо пропустить свои (правило №3 касается
// продуктового кода, не тестовых фикстур двух разных бутстрапов).
import type { Page } from '@playwright/test';

export const STUB_NEEDS = [
  {
    id: 'attachment',
    emoji: '🤝',
    title: 'Привязанность',
    chartLabel: 'Привяз.',
  },
  { id: 'autonomy', emoji: '🧭', title: 'Автономия', chartLabel: 'Автон.' },
  {
    id: 'expression',
    emoji: '🎭',
    title: 'Самовыражение',
    chartLabel: 'Выраж.',
  },
  { id: 'play', emoji: '🎨', title: 'Игра', chartLabel: 'Игра' },
  { id: 'limits', emoji: '🧱', title: 'Границы', chartLabel: 'Границы' },
];

const EMPTY_ARRAY_ENDPOINTS = [
  '/api/plan/pending',
  '/api/plans/history',
  '/api/practices',
  '/api/childhood-ratings',
  '/api/diary/schema',
  '/api/diary/mode',
  '/api/diary/gratitude',
  '/api/schema-notes',
  '/api/mode-notes',
  '/api/therapy/tasks',
];

export interface StubApiHandle {
  /** Как и в webapp-стабе: оценки живут в памяти теста — сохранение обязано
   *  реально дойти до «сервера» и вернуться при следующем чтении. */
  ratings: Record<string, number>;
}

/**
 * Перехватывает `**\/api/**` фикстурами, которых хватает авторизованному
 * AppShell мини-аппа, чтобы догрузиться до экрана «Сегодня» и не упасть.
 */
export async function stubMiniApi(page: Page): Promise<StubApiHandle> {
  const ratings: Record<string, number> = {};

  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    const method = route.request().method();
    const json = (body: unknown) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });

    // Обмен настоящей initData (см. openMiniApp в miniapp-smoke.spec.ts) —
    // тот же эндпоинт, что host.sessionExchange() зовёт в проде.
    if (path.endsWith('/api/auth/refresh') && method === 'POST') {
      return route.fulfill({ status: 401, body: '' });
    }
    if (path.endsWith('/api/auth/telegram/webapp') && method === 'POST') {
      return json({ accessToken: 'e2e-miniapp-token', expiresIn: 3600 });
    }

    if (path.endsWith('/api/needs')) return json(STUB_NEEDS);
    if (path.endsWith('/api/ratings')) return json(ratings);
    if (path.endsWith('/api/rating') && method === 'POST') {
      const body = route.request().postDataJSON() as {
        needId: string;
        value: number;
      };
      ratings[body.needId] = body.value;
      return json({
        ok: true,
        allDone: Object.keys(ratings).length === STUB_NEEDS.length,
      });
    }

    // Флаги онбординга — уже пройден, чтобы оверлей первого входа не
    // перехватывал клики (правило CLAUDE.md про очевидность онбординга
    // проверяется отдельным UI-ревью, не этим смоком про сборку/сеть).
    if (path.endsWith('/api/user-flags'))
      return json({ onboardingV2Done: true });
    if (path.endsWith('/api/settings'))
      return json({ addressForm: 'ty', notifyEnabled: true });
    if (path.endsWith('/api/disclaimer')) return json({ accepted: true });
    if (path.endsWith('/api/streak'))
      return json({ todayDone: false, totalDays: 0 });
    // partners:[] — иначе `pairData.partners.length` в App.tsx падает
    // TypeError на дефолтном catch-all `{}` (там нет поля partners).
    if (path.endsWith('/api/pair'))
      return json({ partners: [], pendingCode: null });

    if (EMPTY_ARRAY_ENDPOINTS.some((ep) => path.endsWith(ep))) return json([]);

    // Полная форма UserProfile (shared/src/types.ts) — TodaySection читает
    // вложенные поля без защитного `?.` (см. support/stubApi.ts webapp).
    if (path.endsWith('/api/profile')) {
      return json({
        name: null,
        role: 'CLIENT',
        ysq: { completedAt: null, activeSchemaIds: [] },
        notifications: {
          enabled: true,
          reminderEnabled: true,
          timezone: 'Europe/Moscow',
          localHour: 20,
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
      });
    }

    // Всё остальное — пустой успех: смок не про полноту API, а про то, что
    // сборка не падает на неожиданном ответе.
    return json({});
  });

  return { ratings };
}

/**
 * URL-хэш настоящего запуска из Telegram (`#tgWebAppData=…`). Собран так же,
 * как это делает клиент Telegram: сырая initData (сам содержит `&`/`=`)
 * кодируется ОДИН раз для вложения в параметр хэша — её же встроенный
 * `telegram-web-app.js` (webapp/public/, отдаётся statik-сервером на "/",
 * см. support/miniappStaticServer.mjs) разбирает эту строку и создаёт
 * window.Telegram.WebApp. initData не обязана быть валидной подписью: бэкенд
 * застаблен (stubMiniApi перехватывает /api/auth/telegram/webapp) — важна
 * только форма строки, которую видит РЕАЛЬНЫЙ парсер в бандле.
 *
 * Через этот же хэш неявно проверяется и фикс инцидента 2026-08-08: если бы
 * регэксп max-bridge.js (`(^|[#&])WebAppData=`) снова стал искать подстроку,
 * он бы сработал на `tgWebAppData=` и попытался бы догрузить чужой SDK
 * с max.ru — сеть в тесте недоступна, страница получила бы pageerror.
 */
export function telegramLaunchHash(): string {
  const user = encodeURIComponent(
    JSON.stringify({ id: 555000111, first_name: 'E2E' }),
  );
  const rawInitData = `user=${user}&auth_date=1700000000&hash=e2e0000000000000000000000000000000000000000000000000000000000`;
  return `#tgWebAppData=${encodeURIComponent(rawInitData)}&tgWebAppVersion=8.0&tgWebAppPlatform=ios`;
}

/** Открывает мини-апп так, как его открывает Telegram — путь + хэш с самого
 *  первого запроса (не history.replaceState постфактум: инициализация хоста
 *  читает location.hash синхронно при загрузке скрипта). */
export async function openMiniApp(page: Page): Promise<void> {
  await page.goto(`/app/${telegramLaunchHash()}`);
}

/** Ошибки рантайма — то, с чего начинается белый экран у пользователя. */
export function throwOnPageError(page: Page): void {
  page.on('pageerror', (err) => {
    throw new Error(`Ошибка в рантайме страницы: ${err.message}`);
  });
}
