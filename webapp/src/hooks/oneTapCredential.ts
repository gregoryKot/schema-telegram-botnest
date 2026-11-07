import type { OneTapResponse } from './googleOneTapTypes';

// Отправка credential (id_token от Google) на сервер: он проверяет подпись,
// nonce и client id и выдаёт нашу сессию (src/auth/auth-one-tap.controller.ts).
// Отказ сервера — значение `{ ok: false, status }`, чтобы хук мог сообщить код в
// телеметрию; сеть легла или ответ не разобрался — бросает, ловит хук.
export type OneTapReply =
  { ok: true; data: OneTapResponse } | { ok: false; status: number };

export async function postOneTapCredential(
  apiBase: string,
  credential: string,
): Promise<OneTapReply> {
  const res = await fetch(`${apiBase}/api/auth/google/one-tap`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'x-requested-with': 'one-tap',
    },
    body: JSON.stringify({ credential }),
  });
  if (!res.ok) return { ok: false, status: res.status };
  return { ok: true, data: (await res.json()) as OneTapResponse };
}
