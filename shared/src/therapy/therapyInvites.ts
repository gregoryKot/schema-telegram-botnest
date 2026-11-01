import { useCallback, useEffect, useState } from 'react';

type Tr = (ty: string, vy: string) => string;

// Живые приглашения терапевта — блок «Ждут подключения» в кабинете обоих
// фронтендов (инцидент 2026-10-26). Раньше приглашение жило только в ответе
// «создать»: закрыл экран — кода больше нигде нет, а повторный тап отдавал
// тот же код второму клиенту. Теперь каждое приглашение — свой код, и
// терапевт видит, кто ещё не подключился, может скопировать код снова или
// отозвать лишнее (живых не больше предела сервера, MAX_LIVE_INVITES).
export interface TherapyInvite {
  id: number;
  code: string;
  url: string;
  /** Имя клиента, введённое в «Новый клиент»; null — приглашение без имени. */
  alias: string | null;
  createdAt: string;
  /** Момент, когда код перестанет действовать. */
  expiresAt: string;
}

export interface PendingInvitesApi {
  getTherapyInvites: () => Promise<TherapyInvite[]>;
  revokeTherapyInvite: (id: number) => Promise<unknown>;
}

/**
 * `invites`: undefined — грузится, null — не загрузилось (сбой ≠ пусто),
 * массив — живые приглашения. `revokeFailed` — id строки, чей отзыв не
 * прошёл; после сбоя список перечитывается: приглашение могли принять или
 * отозвать с другого устройства, и тогда строка просто уходит.
 */
export function usePendingInvites(api: PendingInvitesApi) {
  const [invites, setInvites] = useState<TherapyInvite[] | null | undefined>(
    undefined,
  );
  const [revokeFailed, setRevokeFailed] = useState<number | null>(null);

  const reload = useCallback(() => {
    // Синхронный бросок метода (сбой до запроса) — тоже «не загрузилось».
    Promise.resolve()
      .then(() => api.getTherapyInvites())
      .then(setInvites)
      .catch(() => setInvites(null));
  }, [api]);

  useEffect(reload, [reload]);

  const revoke = async (id: number) => {
    setRevokeFailed(null);
    try {
      await api.revokeTherapyInvite(id);
      setInvites((cur) => cur && cur.filter((i) => i.id !== id));
    } catch {
      setRevokeFailed(id);
      reload();
    }
  };

  return { invites, reload, revoke, revokeFailed };
}

export type PendingInvites = ReturnType<typeof usePendingInvites>;

/** Отказ POST /api/therapy/invite: предел живых — свой текст, иначе общий. */
export function inviteCreateErrorText(err: unknown, tr: Tr): string {
  const e = (err ?? {}) as { status?: unknown; reason?: unknown };
  if (e.status === 409 && e.reason === 'too_many_invites')
    return tr(
      'Неиспользованных приглашений слишком много. Отзови ненужные в блоке «Ждут подключения» — и создай новое',
      'Неиспользованных приглашений слишком много. Отзовите ненужные в блоке «Ждут подключения» — и создайте новое',
    );
  return tr(
    'Не удалось создать приглашение. Попробуй ещё раз',
    'Не удалось создать приглашение. Попробуйте ещё раз',
  );
}
