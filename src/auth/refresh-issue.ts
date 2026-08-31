// Выдача новой пары токенов в существующей семье.
//
// Вынесено из auth.service.ts: тот файл вдвое перерос лимит (правило №10
// CLAUDE.md — раздутый файл дробится, а не пухнет дальше), а здесь чистая
// последовательность записей, которой от сервиса нужны только хеширование и
// подпись access-токена.
//
// Общая для обычной ротации и для восстановления потерянного ответа: у
// восстановления нет своей логики выдачи, есть только другой повод.
import * as crypto from 'crypto';
import type { PrismaService } from '../prisma/prisma.service';

export interface RotatingSession {
  tokenHash: string;
  userId: bigint;
  family: string;
  /** Хеш прежнего наследника — есть только при восстановлении. */
  replacedByHash: string | null;
}

export interface IssueRotatedDeps {
  prisma: PrismaService;
  hashToken: (raw: string) => string;
  signAccessToken: (userId: bigint) => string;
  accessTtlS: number;
  refreshTtlS: number;
}

export interface RotatedPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  rotated: true;
}

/** Пара «только access, кука прежняя»: свежий доступ на том же refresh. */
export interface AccessOnlyPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  rotated: false;
}

/**
 * Ответ, не меняющий refresh-куку: свежий access на прежнем токене. Один и тот
 * же исход у «ротировали недавно» и у «проиграли гонку ротации» — держим в
 * одном месте, чтобы не дублировать объект по вызовам (jscpd).
 */
export function accessOnlyPair(
  accessToken: string,
  refreshToken: string,
  expiresIn: number,
): AccessOnlyPair {
  return { accessToken, refreshToken, expiresIn, rotated: false };
}

/**
 * Ротирует пару. Если гонку за эту строку выиграл ДРУГОЙ параллельный рефреш
 * (наследник уже создан им), наследника здесь НЕ плодим и НЕ выкидываем
 * человека: отдаём access-only на прежней куке (`rawRefresh`), клиент
 * восстановится штатным `recover` на следующем рефреше.
 *
 * Атомарность и защита от гонки (разбор 2026-08-31). Раньше старую строку гасил
 * безусловный `update` по первичному ключу: два одновременных рефреша одного
 * живого токена (две вкладки, сайт+PWA на одной куке, повтор недоехавшего
 * ответа) ОБА проходили и создавали ДВА живых наследника в семье. Лишний живой
 * токен детекции кражи не с чем сопоставить — родитель указывает лишь на
 * одного из них, второй живёт «сиротой». Теперь претендента гасим через
 * `updateMany` с условием `revokedAt: null`, и наследника создаём ТОЛЬКО при
 * `count === 1` (мы выиграли гонку). Postgres READ COMMITTED сериализует два
 * таких updateMany на одной строке: проигравший видит `revokedAt` уже
 * непустым и получает `count === 0`.
 */
export async function issueRotatedPair(
  deps: IssueRotatedDeps,
  session: RotatingSession,
  rawRefresh: string,
  ip?: string,
  userAgent?: string,
): Promise<RotatedPair | AccessOnlyPair> {
  const newRaw = crypto.randomBytes(40).toString('hex');
  const newHash = deps.hashToken(newRaw);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + deps.refreshTtlS * 1000);

  const won = await deps.prisma.$transaction(async (tx) => {
    if (session.replacedByHash) {
      // Восстановление: живой претендент — прежний наследник. Гасим его
      // атомарно; выиграли — репойнтим старую строку на НОВОГО наследника
      // (`replacedByHash` — то, по чему следующий повтор отличат от кражи,
      // refresh-rotation.ts).
      const claim = await tx.webSession.updateMany({
        where: { tokenHash: session.replacedByHash, revokedAt: null },
        data: { revokedAt: now },
      });
      if (claim.count === 0) return false;
      await tx.webSession.update({
        where: { tokenHash: session.tokenHash },
        data: { revokedAt: now, replacedByHash: newHash },
      });
    } else {
      // Обычная ротация: атомарно переводим ЖИВОГО родителя в отозванного.
      // `revokedAt: null` — тот самый race-breaker: второй параллельный
      // рефреш получит count 0 и наследника не создаст.
      const claim = await tx.webSession.updateMany({
        where: { tokenHash: session.tokenHash, revokedAt: null },
        data: { revokedAt: now, replacedByHash: newHash },
      });
      if (claim.count === 0) return false;
    }
    await tx.webSession.create({
      data: {
        id: crypto.randomUUID(),
        userId: session.userId,
        tokenHash: newHash,
        family: session.family,
        expiresAt,
        ipAddress: ip,
        userAgent,
      },
    });
    return true;
  });

  if (!won) {
    return accessOnlyPair(
      deps.signAccessToken(session.userId),
      rawRefresh,
      deps.accessTtlS,
    );
  }
  return {
    accessToken: deps.signAccessToken(session.userId),
    refreshToken: newRaw,
    expiresIn: deps.accessTtlS,
    rotated: true,
  };
}
