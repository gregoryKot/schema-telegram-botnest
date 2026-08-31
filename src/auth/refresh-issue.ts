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

export async function issueRotatedPair(
  deps: IssueRotatedDeps,
  session: RotatingSession,
  ip?: string,
  userAgent?: string,
): Promise<RotatedPair> {
  const newRaw = crypto.randomBytes(40).toString('hex');
  const newHash = deps.hashToken(newRaw);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + deps.refreshTtlS * 1000);

  // Пометить старый использованным и создать новый — АТОМАРНО: иначе падение
  // между этими шагами оставляет человека вообще без действующей сессии.
  await deps.prisma.$transaction([
    // Прежний наследник (если восстанавливаем) гасится: живой токен в семье
    // остаётся ровно один, иначе детекция перестала бы что-либо значить.
    ...(session.replacedByHash
      ? [
          deps.prisma.webSession.updateMany({
            where: { tokenHash: session.replacedByHash, revokedAt: null },
            data: { revokedAt: now },
          }),
        ]
      : []),
    // `replacedByHash` на старой строке — то, по чему следующий повтор этого
    // же токена отличат от кражи (refresh-rotation.ts).
    deps.prisma.webSession.update({
      where: { tokenHash: session.tokenHash },
      data: { revokedAt: now, replacedByHash: newHash },
    }),
    deps.prisma.webSession.create({
      data: {
        id: crypto.randomUUID(),
        userId: session.userId,
        tokenHash: newHash,
        family: session.family,
        expiresAt,
        ipAddress: ip,
        userAgent,
      },
    }),
  ]);

  return {
    accessToken: deps.signAccessToken(session.userId),
    refreshToken: newRaw,
    expiresIn: deps.accessTtlS,
    rotated: true,
  };
}
