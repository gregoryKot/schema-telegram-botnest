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
import type { Page } from '@playwright/test';

export const STUB_NEEDS = [
  {
    id: 'attachment',
    emoji: '🤝',
    title: 'Привязанность',
    chartLabel: 'Привяз.',
  },
  { id: 'autonomy', emoji: '🧭', title: 'Автономия', chartLabel: 'Автон.' },
  { id: 'freedom', emoji: '🕊', title: 'Свобода', chartLabel: 'Свобода' },
  { id: 'play', emoji: '🎨', title: 'Игра', chartLabel: 'Игра' },
  { id: 'limits', emoji: '🧱', title: 'Границы', chartLabel: 'Границы' },
];

// Массивы бутстрапа AppShell/PracticeSection — без явной фикстуры они падают
// не на «пустой ответ», а на .filter/.slice поверх дефолтного `{}` из
// catch-all (правило «сбой ≠ пусто» касается и тестовых фикстур: пустой
// массив — валидное пустое состояние, объект вместо массива — рантайм-ошибка).
const EMPTY_ARRAY_ENDPOINTS = [
  '/api/therapy/tasks',
  '/api/therapy/tasks/history',
  '/api/practices',
  '/api/plan/pending',
  '/api/schema-notes',
  '/api/mode-notes',
  '/api/belief-checks',
  '/api/letters',
];

export interface StubApiHandle {
  /**
   * Оценки живут в памяти теста, а не в фикстуре-константе: сохранение
   * должно реально доехать до «сервера» и вернуться при следующем чтении —
   * иначе проверка «пережило перезагрузку» была бы самообманом.
   */
  ratings: Record<string, number>;
}

/**
 * Перехватывает `**\/api/**` фикстурами, которых достаточно, чтобы
 * авторизованный AppShell загрузился и не упал: вход, needs/ratings,
 * бутстрап-массивы, профиль/дисклеймер. Всё остальное — пустой успех: смок
 * не про полноту API, а про то, что сборка не падает на неожиданном ответе.
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

    if (path.endsWith('/api/auth/refresh') && method === 'POST') {
      return json({ accessToken: 'e2e-test-token', expiresIn: 3600 });
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
    // addressForm НЕ null: иначе AddressFormPicker («Как удобнее общаться?»)
    // рисует fixed-оверлей поверх всего приложения и перехватывает клики
    // авторизованных сценариев (трекер/кризисный путь) — сам онбординг формы
    // обращения тестируется отдельно юнитами AddressFormPicker.test.tsx.
    if (path.endsWith('/api/settings'))
      return json({ addressForm: 'ty', notifyEnabled: true });
    if (path.endsWith('/api/streak'))
      return json({ todayDone: false, totalDays: 0 });

    if (EMPTY_ARRAY_ENDPOINTS.some((ep) => path.endsWith(ep))) return json([]);

    // Полная форма UserProfile (shared/src/types.ts) — не сокращённая
    // заглушка: TodaySection читает `profile.ysq.activeSchemaIds` без
    // защитного `?.` на вложенном поле, и урезанный `{role:'CLIENT'}` ронял
    // экран рантайм-ошибкой (поймано этим же смоком до фикса фикстуры).
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
    if (path.endsWith('/api/disclaimer')) return json({ accepted: true });

    // Всё остальное — пустой успех: смок не про полноту API, а про то, что
    // приложение не падает на неожиданном ответе.
    return json({});
  });

  return { ratings };
}

/** Ошибки рантайма — то, с чего начинается белый экран у пользователя. */
export function throwOnPageError(page: Page): void {
  page.on('pageerror', (err) => {
    throw new Error(`Ошибка в рантайме страницы: ${err.message}`);
  });
}
