import { useCallback, useEffect, useState } from 'react';
import type { UserId } from '../userId';
import { sameId } from '../utils/sameId';

// Сверка «Это тот же человек?» (аудит 2026-11, S8; решение владельца Р3).
// Код приглашения из офлайн-карточки мог ввести кто угодно, у кого он
// оказался. Сервер больше не переносит записи карточки сразу: аккаунт
// подключается без них, а терапевт видит над списком клиентов плашку и
// отвечает. «Да» — задания, заметки, карты режимов и концептуализация
// карточки переезжают на аккаунт; «Нет» — карточка остаётся офлайн.
// Сервер — src/therapy/therapy-invite-card-claim.ts.
export interface CardClaim {
  /** Аккаунт, который ввёл код. */
  clientId: UserId;
  /** Как терапевт видит этот аккаунт в списке; null — без имени. */
  clientName: string | null;
  /** Офлайн-карточка (= -telegramId карточки в списке клиентов). */
  cardId: number;
  cardName: string | null;
}

export interface CardClaimsApi {
  getCardClaims: () => Promise<CardClaim[]>;
  resolveCardClaim: (
    clientId: UserId,
    cardId: number,
    accept: boolean,
  ) => Promise<unknown>;
}

/** Ключ плашки: один аккаунт и одна карточка. */
export const cardClaimKey = (c: CardClaim): string =>
  `${String(c.clientId)}:${c.cardId}`;

/**
 * Какие плашки остаются после ответа. «Да» сливает карточку — сервер снимает
 * её сверки и с других аккаунтов, поэтому уходят все плашки этой карточки;
 * «Нет» — только отвеченная.
 */
export function afterResolve(
  claims: CardClaim[],
  answered: CardClaim,
  accept: boolean,
): CardClaim[] {
  return claims.filter((c) =>
    accept
      ? c.cardId !== answered.cardId
      : !(
          c.cardId === answered.cardId && sameId(c.clientId, answered.clientId)
        ),
  );
}

/**
 * `claims`: undefined — грузится, null — не загрузилось (сбой ≠ пусто),
 * массив — сверки. `busy`/`failed` — ключ плашки (cardClaimKey), ответ по
 * которой в пути или не прошёл; после сбоя список перечитывается: на сверку
 * могли ответить с другого устройства. `onMerged` — после «Да» меняется
 * список клиентов (карточка исчезает, имя переезжает на аккаунт).
 */
export function useCardClaims(api: CardClaimsApi, onMerged?: () => void) {
  const [claims, setClaims] = useState<CardClaim[] | null | undefined>(
    undefined,
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  const reload = useCallback(() => {
    Promise.resolve()
      .then(() => api.getCardClaims())
      .then(setClaims)
      .catch(() => setClaims(null));
  }, [api]);
  useEffect(reload, [reload]);

  const resolve = async (claim: CardClaim, accept: boolean) => {
    setBusy(cardClaimKey(claim));
    setFailed(null);
    try {
      await api.resolveCardClaim(claim.clientId, claim.cardId, accept);
      setClaims((cur) => cur && afterResolve(cur, claim, accept));
      if (accept) onMerged?.();
    } catch {
      setFailed(cardClaimKey(claim));
      reload();
    } finally {
      setBusy(null);
    }
  };

  return { claims, resolve, busy, failed };
}

export type CardClaims = ReturnType<typeof useCardClaims>;
