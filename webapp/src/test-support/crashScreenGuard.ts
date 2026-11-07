// Страж «экран падения в DOM»: тест краснеет, если к его концу (или в любой
// момент по ходу) в DOM рисовался экран падения — ErrorBoundary («Раздел упал»)
// или RouteErrorScreen («Что-то пошло не так»). Границы ловят ошибку и рисуют
// <h1>, а браузер ошибку наружу не отдаёт: тест с «getByRole('heading')» зелёный
// на упавшем разделе (#936, /articles в браузерном смоке). Намеренный экран
// падения тест разрешает вызовом allowCrashScreen() — только на этот тест.
//
// Только webapp: в shared/ нет границ ошибок (нет componentDidCatch,
// getDerivedStateFromError и errorElement), рисовать экран падения там нечему.
//
// Обнаружение — по DOM-маркеру data-crash-screen на корне экрана, не по
// console.error: тесты глушат console.error через vi.spyOn(...).mockImplementation.
// Маркер закреплён тестом crashScreenGuard.test.tsx — редизайн экрана не
// выключит стража молча. Экран ловит MutationObserver (а не только финальный
// скан DOM): в файлах с собственным afterEach(cleanup) DOM пуст к моменту стража.
//
// Порядок хуков: vitest 5 гоняет afterEach в ОБРАТНОМ порядке регистрации
// (проверено опытом: local → setupFiles[последний] → … → setupFiles[первый]).
// Страж в setupFiles стоит ПОСЛЕ rtlCleanup.ts, чтобы сработать до его cleanup().
import { afterEach, beforeEach } from 'vitest';

export const CRASH_SCREEN_ATTR = 'data-crash-screen';
const SELECTOR = `[${CRASH_SCREEN_ATTR}]`;

let allowed = false;
let sightings: string[] = [];
let observer: MutationObserver | null = null;

/** Разрешить экран падения в ТЕКУЩЕМ тесте; после теста сбрасывается. */
export function allowCrashScreen(): void {
  allowed = true;
}

export function isCrashScreenAllowed(): boolean {
  return allowed;
}

/** Описание экрана падения: какой, заголовок и «Детали ошибки», если есть. */
export function describeCrashScreen(el: Element): string {
  const kind = el.getAttribute(CRASH_SCREEN_ATTR) || 'unknown';
  const title = el.querySelector('h1')?.textContent?.trim() ?? '';
  const detail = el.querySelector('.sk-crash-msg')?.textContent?.trim();
  return `${kind} «${title}»${detail ? `, ошибка: ${detail}` : ''}`;
}

/** Все экраны падения внутри root (и сам root, если он экран). */
export function findCrashScreens(root: Element): string[] {
  const found: Element[] = [];
  if (root.matches(SELECTOR)) found.push(root);
  root.querySelectorAll(SELECTOR).forEach((el) => found.push(el));
  return found.map(describeCrashScreen);
}

/** Бросает, если были экраны падения и они не разрешены. */
export function assertNoCrashScreen(seen: string[], isAllowed: boolean): void {
  if (isAllowed || seen.length === 0) return;
  throw new Error(
    `Тест нарисовал экран падения: ${[...new Set(seen)].join('; ')}.\n` +
      'Раздел упал, а тест этого не заметил (браузер ошибку границы наружу не отдаёт). ' +
      'Почини падение или, если экран падения тут намеренный, ' +
      'вызови allowCrashScreen() из test-support/crashScreenGuard в этом тесте.',
  );
}

function collect(records: MutationRecord[]): void {
  for (const r of records) {
    r.addedNodes.forEach((n) => {
      if (n.nodeType === 1) sightings.push(...findCrashScreens(n as Element));
    });
  }
}

beforeEach(() => {
  allowed = false;
  sightings = [];
  observer?.disconnect();
  observer = null;
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
  observer = new MutationObserver(collect);
  observer.observe(document.documentElement, { childList: true, subtree: true });
});

afterEach(() => {
  const isAllowed = allowed;
  allowed = false;
  if (!observer) return;
  collect(observer.takeRecords());
  observer.disconnect();
  observer = null;
  const seen = [...sightings, ...findCrashScreens(document.documentElement)];
  sightings = [];
  assertNoCrashScreen(seen, isAllowed);
});
