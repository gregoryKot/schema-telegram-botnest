// Связь клиента с терапевтом для браузерных смоков: состояние живёт в памяти
// теста, чтобы «подключился → отключился» проходило через «сервер», а не через
// фикстуру-константу (тот же принцип, что у ratings в stubApi.ts).
import type { Route } from '@playwright/test';

export const STUB_INVITE_CODE = 'ABCDEF123456';

const RELATION = {
  role: 'client',
  status: 'active',
  partnerName: 'Анна',
  partnerId: 4300000000001,
  code: STUB_INVITE_CODE,
  nextSession: null,
  meetingDays: [],
};

export interface StubTherapyHandle {
  connected: boolean;
}

/**
 * Отвечает на `/api/therapy/{relation,join,invite/preview,former-therapist}`;
 * возвращает true, если путь обработан. «Нет связи» — ПУСТОЕ тело, как у
 * настоящего Nest (`return null` → response.send() без аргумента).
 */
export async function handleTherapyRoute(
  route: Route,
  state: StubTherapyHandle,
): Promise<boolean> {
  const path = new URL(route.request().url()).pathname;
  const method = route.request().method();
  const json = (body: unknown, status = 200) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  const empty = () => route.fulfill({ status: 200, body: '' });

  if (path.endsWith('/api/therapy/relation')) {
    if (method === 'DELETE') {
      state.connected = false;
      await json({ ok: true });
    } else if (state.connected) await json(RELATION);
    else await empty();
    return true;
  }
  if (path.endsWith('/api/therapy/former-therapist')) {
    await empty();
    return true;
  }
  if (path.endsWith('/api/therapy/invite/preview')) {
    await json({ therapistName: 'Анна', connection: 'none' });
    return true;
  }
  if (path.endsWith('/api/therapy/join') && method === 'POST') {
    const { code } = route.request().postDataJSON() as { code: string };
    if (String(code).toUpperCase() !== STUB_INVITE_CODE) {
      await json({ message: 'Invalid or expired code' }, 400);
    } else {
      state.connected = true;
      await json({ ok: true }, 201);
    }
    return true;
  }
  return false;
}
