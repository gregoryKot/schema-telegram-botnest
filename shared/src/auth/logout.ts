// Общий сетевой шаг выхода: POST /api/auth/logout — сервер отзывает WebSession
// и гасит refresh-куку. Локальную чистку каждый фронт делает по-своему (у сайта
// — AuthProvider, у мини-аппа — session.ts), но сам вызов один: правило №3
// (общий код — в shared, а не копипастой; раньше сайт слал этот fetch inline,
// а мини-апп выхода не имел вовсе — разбор 2026-09-03).
//
// requireCsrf на сервере пускает по непустому x-requested-with ИЛИ по
// Content-Type: application/json (см. auth-http.util.ts) — шлём оба.

export interface LogoutOptions {
  /** true → ?all=true: отозвать сессии на ВСЕХ устройствах, не только эту. */
  all?: boolean;
  /** Значение x-requested-with — метка источника в аудит-логе ('webapp'/'miniapp'). */
  requestedWith: string;
}

export async function postLogout(
  apiBase: string,
  opts: LogoutOptions,
): Promise<void> {
  try {
    await fetch(`${apiBase}/api/auth/logout${opts.all ? '?all=true' : ''}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'x-requested-with': opts.requestedWith,
        'Content-Type': 'application/json',
      },
    });
  } catch {
    // Сеть легла — сервер refresh-куку не погасил, но человек нажал «Выйти»:
    // локальная чистка обязана состояться, экран должен смениться. Сайт вёл
    // себя так же (best-effort). Не тихий catch: см. комментарий (правило №15).
  }
}
