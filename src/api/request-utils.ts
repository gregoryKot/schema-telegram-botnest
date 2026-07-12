import { BadRequestException } from '@nestjs/common';

// Единый источник uid()/parseId() для всех контроллеров (аудит 2026-07, 2в):
// раньше три копипасты незаметно разошлись поведением — diary принимал
// «5abc» как 5 (parseInt), therapy разрешал отрицательные id без объяснения.

export interface AuthRequest {
  webUser: { userId: bigint };
  telegramUserId?: number;
  telegramFirstName?: string;
}

/** Канонический BigInt userId — точен и для Google/VK-аккаунтов (> 2^53 не бывает, но не рискуем). */
export function uid(req: AuthRequest): bigint {
  return req.webUser.userId;
}

/**
 * Парсит id из path-параметра. Строго: только целое число без мусора
 * («5abc» — ошибка, а не 5).
 *
 * `allowNegative` — ТОЛЬКО для therapy-эндпоинтов: виртуальные (офлайн)
 * клиенты терапевта кодируются отрицательным id = -TherapyRelation.id.
 * Везде, где виртуальных клиентов нет, отрицательный id — ошибка запроса.
 */
export function parseId(
  raw: string,
  opts: { allowNegative?: boolean } = {},
): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n === 0 || (!opts.allowNegative && n < 0)) {
    throw new BadRequestException('Invalid id');
  }
  return n;
}
