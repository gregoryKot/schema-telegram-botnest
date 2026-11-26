import type { PrismaService } from '../prisma/prisma.service';

// Переезжает ли второй фактор при merge — вынесено из merge.service.ts,
// который давно за потолком 300 строк и по правилу №10 обязан таять, а не
// расти вместе с каждой новой веткой подтверждения.
//
// Ответ всегда «нет»: totpSecret/totpEnabledAt/totpRecoveryCodes помечены
// skip в merge-user-rules.ts — второй фактор принадлежит аккаунту, не
// человеку. Решение осознанное, но до аудита 2026-07 (M4) о нём молчали все
// экраны подтверждения, и человек с включённой 2FA терял её незаметно.
// Поэтому считаем не «теряется ли вообще», а «пропадёт ли защита у того, кто
// останется»: если у цели свой второй фактор уже есть, терять нечего и пугать
// незачем.
export async function twoFactorWillBeLost(
  prisma: PrismaService,
  sourceId: bigint,
  targetId: bigint,
): Promise<boolean> {
  const pick = { select: { totpEnabledAt: true } } as const;
  const [source, target] = await Promise.all([
    prisma.user.findUnique({ where: { id: sourceId }, ...pick }),
    prisma.user.findUnique({ where: { id: targetId }, ...pick }),
  ]);
  return source?.totpEnabledAt != null && target?.totpEnabledAt == null;
}
