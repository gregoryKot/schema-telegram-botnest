// Шлюз Метрики: можно ли сейчас грузить счётчик и слать в него хиты/цели.
// Два условия сразу — маршрут публичный (metrikaRoutes) И сессии нет.
// Состояние сессии — на уровне модуля, а не хук: metrika.ts зовут из
// обычных функций (trackGoal в обработчиках), React-контекста у них нет.
import { isPublicMetrikaRoute } from './metrikaRoutes';

// По умолчанию «сессия возможна»: пока MetrikaTracker (внутри AuthProvider)
// не доложил, что вход не состоялся, счётчик молчит. Отказ по умолчанию —
// безопасный: забытая проводка отключит аналитику, а не включит её на
// клиническом экране.
let sessionPossible = true;

/**
 * Состояние входа. `true` — сессия есть ИЛИ ещё проверяется (isLoading):
 * человек, у которого кука уже лежит, не должен успеть получить счётчик на
 * главной за те мгновения, пока refresh не ответил.
 */
export function setMetrikaSessionPossible(value: boolean): void {
  sessionPossible = value;
}

export function metrikaAllowed(
  pathname: string = typeof window === 'undefined' ? '' : window.location.pathname,
): boolean {
  return !sessionPossible && isPublicMetrikaRoute(pathname);
}
