// Общий сетевой шаг выхода: POST /api/auth/logout — сервер отзывает WebSession
// и гасит refresh-куку. Локальную чистку делает фронт (у сайта — AuthProvider),
// сам вызов один (правило №3); таймаут — чтобы зависшая сеть не держала «Выйти»
// вечно (аудит 2026-11, E9).
//
// requireCsrf на сервере пускает по непустому x-requested-with ИЛИ по
// Content-Type: application/json (см. auth-http.util.ts) — шлём оба.
import { fetchWithTimeout } from '../api/fetchWithTimeout';

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
  const query = opts.all ? '?all=true' : '';
  try {
    await fetchWithTimeout(`${apiBase}/api/auth/logout${query}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'x-requested-with': opts.requestedWith,
        'Content-Type': 'application/json',
      },
    });
  } catch {
    // Сеть легла или таймаут — сервер куку не погасил, но человек нажал «Выйти»:
    // локальная чистка обязана состояться (best-effort, не тихий catch — №15).
  }
}
