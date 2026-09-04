import { useEffect, useRef } from 'react';

// Google One Tap: нативная всплывашка Google прямо на сайте. Если человек уже
// вошёл в Google в этом браузере — показывает «Продолжить как …» одним
// касанием, без ухода на страницу Google. Токен (id_token) прилетает в колбэк
// в браузер, мы постим его на /api/auth/google/one-tap и получаем свою сессию.
//
// Необязательный путь: если VITE_GOOGLE_CLIENT_ID не задан, скрипт Google не
// загрузился, origin не разрешён в Google Cloud Console или всплывашку не
// показали — просто ничего не происходит, остаются обычные кнопки входа.
// Поэтому все сбои здесь ГЛОТАЮТСЯ намеренно: это не экран-тупик, у человека
// всегда есть кнопки ниже.

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';

interface CredentialResponse {
  credential?: string;
}
interface GoogleIdApi {
  initialize(cfg: {
    client_id: string;
    callback: (r: CredentialResponse) => void;
    use_fedcm_for_prompt?: boolean;
    auto_select?: boolean;
  }): void;
  prompt(): void;
  cancel(): void;
}
declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdApi } };
  }
}

interface OneTapResponse {
  accessToken?: string;
  expiresIn?: number;
  twofa?: boolean;
  challengeToken?: string;
}

/**
 * Запускает One Tap, пока экран входа открыт. `enabled` — показывать ли (обычно
 * только пока человек не вошёл). `onSession` кладёт выданную сессию, `onTwofa`
 * уводит на ввод второго фактора (у аккаунта включён 2FA — сессию сразу не
 * выдаём, как и в редирект-флоу).
 */
export function useGoogleOneTap(opts: {
  enabled: boolean;
  onSession: (accessToken: string, expiresIn: number) => void;
  onTwofa: (challengeToken: string) => void;
  /**
   * Куда сообщить о СБОЕ отправки credential (сеть легла). Не экран-тупик —
   * кнопки остаются, поэтому не обязателен и без текста ошибки (правило №7: в
   * отчёт не уходит ни адрес, ни тело — только факт).
   */
  onError?: (payload: { message: string; section: string }) => void;
}): void {
  const { enabled } = opts;
  // Колбэки держим в ref: их пересоздание в родителе не должно перезапускать
  // всплывашку (иначе Google посчитал бы это повторным показом и притих).
  // Обновляем ref в эффекте, а не в теле рендера (react-hooks/refs запрещает
  // доступ к ref во время рендера); колбэки читаются асинхронно — в fetch и
  // таймере, уже после коммита, — поэтому видят свежие значения.
  const cb = useRef(opts);
  useEffect(() => {
    cb.current = opts;
  });

  useEffect(() => {
    if (!enabled || !CLIENT_ID) return;
    let cancelled = false;
    let tries = 0;

    const submit = async (credential: string): Promise<void> => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/google/one-tap`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'x-requested-with': 'one-tap',
          },
          body: JSON.stringify({ credential }),
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as OneTapResponse;
        if (cancelled) return;
        if (data.twofa && data.challengeToken) {
          cb.current.onTwofa(data.challengeToken);
        } else if (data.accessToken) {
          cb.current.onSession(data.accessToken, data.expiresIn ?? 900);
        }
      } catch {
        // Сеть моргнула — One Tap необязателен, у человека есть кнопки ниже.
        // Не молчим совсем: рассинхрон входа должен быть виден в телеметрии
        // (правило №14), но без шума на экране.
        cb.current.onError?.({
          message: 'one-tap submit failed',
          section: 'login.one-tap',
        });
      }
    };

    const init = (): void => {
      const id = window.google?.accounts?.id;
      if (!id) {
        // Скрипт GIS грузится асинхронно (async в index.html) — ждём ~4с.
        if (cancelled || tries++ > 40) return;
        setTimeout(init, 100);
        return;
      }
      id.initialize({
        client_id: CLIENT_ID,
        callback: (r) => {
          if (r.credential) void submit(r.credential);
        },
        use_fedcm_for_prompt: true,
      });
      id.prompt();
    };
    init();

    return () => {
      cancelled = true;
      window.google?.accounts?.id?.cancel();
    };
  }, [enabled]);
}
