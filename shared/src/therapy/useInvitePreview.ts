import { useEffect, useState } from 'react';

export type InvitePreview =
  | { state: 'loading' }
  | { state: 'ok'; therapistName: string | null }
  /** Сервер ответил 400: код не действует (принят, отозван, просрочен, свой). */
  | { state: 'invalid' }
  /** Сеть или сервер упали — неизвестно; экран согласия работает как раньше. */
  | { state: 'unknown' };

// Экран согласия на подключение к терапевту (JoinConfirmSheet обоих
// фронтендов): чей код — до того, как человек откроет доступ к записям.
// До 2026-10-26 окно спрашивало «Открыть доступ терапевту?», не называя кому.
// Имя приходит с сервера (POST /api/therapy/invite/preview), без выдумки:
// нет имени в профиле — строки нет.
export function useInvitePreview(
  preview: (code: string) => Promise<{ therapistName: string | null }>,
  code: string,
  enabled: boolean,
): InvitePreview {
  const [result, setResult] = useState<InvitePreview>({ state: 'loading' });

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    preview(code)
      .then((r) => alive && setResult({ state: 'ok', ...r }))
      .catch((e: unknown) => {
        const status = (e as { status?: unknown } | null)?.status;
        if (alive) setResult({ state: status === 400 ? 'invalid' : 'unknown' });
      });
    return () => {
      alive = false;
    };
  }, [preview, code, enabled]);

  return enabled ? result : { state: 'unknown' };
}
