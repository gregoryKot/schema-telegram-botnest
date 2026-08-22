// Вынесено из auth.service.ts, который уже стоит на потолке размера (правило
// №10 CLAUDE.md) — чистая логика без Prisma, auth.service.ts только вызывает.
//
// Инцидент «постоянно нужно логиниться заново» (2026-08-21). Две независимые
// причины, обе — гонки, не кража чужого refresh-токена:
//
//  1. Reuse-детекция убивала ВСЮ family при первом же повторном использовании
//     уже отозванного токена. В проде так срабатывает не кража, а обычный
//     дребезг: две вкладки одновременно рефрешат, сайт и установленное
//     PWA-приложение делят одну куку, либо ответ на ротацию оборвался и
//     Set-Cookie не доехал до клиента — у него остался токен, который сервер
//     уже пометил использованным. Настоящая кража отличается от дребезга
//     временем: дребезг происходит практически сразу после ротации, кража —
//     когда атакующий получает токен (лог, бэкап, MITM) и пробует его позже.
//  2. Каждая загрузка страницы дергала /api/auth/refresh и ротировала куку —
//     чем чаще ротация, тем шире окно для гонки №1. Если предыдущая ротация
//     этой же сессии была недавно, новый refresh-токен не нужен: access
//     переиздаём, а куку оставляем прежней.

/** Повтор уже отозванного refresh-токена в пределах этого окна считается
 * дребезгом (гонка), а не кражей — family не отзывается. */
export const REFRESH_REUSE_GRACE_MS = 30_000;

/** Не чаще этого интервала ротируем refresh-токен одной и той же сессии —
 * частые загрузки страницы получают только новый access, кука не меняется. */
export const REFRESH_ROTATE_MIN_INTERVAL_MS = 5 * 60_000;

/**
 * true — похоже на настоящую кражу (отозвать всю family), false — дребезг
 * в пределах grace-окна (просто отклонить эту попытку, семью не трогать).
 *
 * `revokedAt: null` — сессия истекла, но не была отозвана ротацией (например,
 * TTL вышел естественно) — это не сценарий гонки ротации, старое поведение
 * (family отзывается, если она есть) сохраняется.
 */
export function isTheftReuse(revokedAt: Date | null, now: Date): boolean {
  if (!revokedAt) return true;
  return now.getTime() - revokedAt.getTime() >= REFRESH_REUSE_GRACE_MS;
}

/** Что делать с повтором отозванного/истёкшего токена — считает всё, что не
 * требует Prisma, чтобы auth.service.ts (уже на потолке размера, правило
 * №10) только исполнял вердикт: отзывал family и логировал. */
export interface ReuseVerdict {
  theft: boolean;
  logMessage: string;
}
export function classifyReuse(
  revokedAt: Date | null,
  now: Date,
  userId: bigint,
): ReuseVerdict {
  const theft = isTheftReuse(revokedAt, now);
  const who = String(userId);
  return {
    theft,
    logMessage: theft
      ? `Refresh token reuse detected — revoking family (userId ${who})`
      : `Refresh token reuse within grace window — race, not theft (userId ${who})`,
  };
}

/**
 * true — эту сессию рано ротировать повторно, выдать новый access и оставить
 * refresh-куку как есть.
 *
 * `createdAt` может отсутствовать только в тестовых fake-Prisma (не строят
 * дефолт `@default(now())`, который Postgres проставляет всегда) — в этом
 * случае не тормозим ротацию, а не падаем на `undefined.getTime()`.
 */
export function shouldSkipRotation(
  createdAt: Date | null | undefined,
  now: Date,
): boolean {
  if (!createdAt) return false;
  return now.getTime() - createdAt.getTime() < REFRESH_ROTATE_MIN_INTERVAL_MS;
}
