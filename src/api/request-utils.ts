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

const INT32_MAX = 2_147_483_647;

/**
 * Парсит id из path-параметра. Строго: только целое число без мусора
 * («5abc» — ошибка, а не 5).
 *
 * M6 (аудит 2026-10): `Number(raw)` принимал '1e20', '0x1f', ' 5 ' и числа за
 * пределами точного представления — такой id молча округлялся и бил не в ту
 * строку (либо Prisma падала 500 на переполнении Int). Теперь строка обязана
 * быть чистой записью целого (`\d{1,16}` — больше 16 цифр Number уже не
 * хранит точно, и `isSafeInteger` это дополнительно сторожит).
 *
 * `allowNegative` — ТОЛЬКО для therapy-эндпоинтов: виртуальные (офлайн)
 * клиенты терапевта кодируются отрицательным id = -TherapyRelation.id.
 * Везде, где виртуальных клиентов нет, отрицательный id — ошибка запроса.
 *
 * `int32` — для id, которые адресуют колонку Int (все модели, кроме
 * User.id = BigInt): значение больше 2^31-1 заведомо не существует, и
 * отдавать его в Prisma незачем. Для therapy-клиентов флаг НЕ ставится:
 * там id — telegramId (до ~1e10), он не влезает в INT4.
 */
export function parseId(
  raw: string,
  opts: { allowNegative?: boolean; int32?: boolean } = {},
): number {
  const re = opts.allowNegative ? /^-?\d{1,16}$/ : /^\d{1,16}$/;
  if (typeof raw !== 'string' || !re.test(raw)) {
    throw new BadRequestException('Invalid id');
  }
  const n = Number(raw);
  if (
    !Number.isSafeInteger(n) ||
    n === 0 ||
    (opts.int32 && Math.abs(n) > INT32_MAX)
  ) {
    throw new BadRequestException('Invalid id');
  }
  return n;
}
