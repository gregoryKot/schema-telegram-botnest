// Обработка повтора отозванного/истёкшего refresh-токена. Вынесено из
// auth.service.ts (потолок размера, правило №10 CLAUDE.md).
import { UnauthorizedException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { classifyReuse } from './refresh-rotation';
import {
  applyRecoverBudget,
  countRecentRecoveries,
} from './refresh-recover-budget';
import { revokeFamilyAndAlert, type TheftAlertDeps } from './refresh-theft';

export interface ReuseDeps extends TheftAlertDeps {
  prisma: PrismaService;
  onWarn: (message: string) => void;
}

export interface ReusedSession {
  userId: bigint;
  family: string;
  revokedAt: Date | null;
  replacedByHash: string | null;
}

/**
 * Возвращает 'recover', если можно выдать новую пару; иначе бросает 401 (при
 * краже — предварительно отозвав семью и подняв алерт).
 */
export async function resolveReuse(
  deps: ReuseDeps,
  session: ReusedSession,
  now: Date,
): Promise<'recover'> {
  const successor = session.replacedByHash
    ? await deps.prisma.webSession.findUnique({
        where: { tokenHash: session.replacedByHash },
      })
    : null;
  let verdict = classifyReuse(session, successor, now, session.userId);
  if (verdict.outcome === 'recover') {
    const recent = await countRecentRecoveries(
      deps.prisma,
      session.family,
      now,
    );
    verdict = applyRecoverBudget(verdict, recent, session.userId);
  }
  deps.onWarn(verdict.logMessage);
  if (verdict.outcome === 'recover') return 'recover';
  if (verdict.outcome === 'theft' && session.family) {
    await revokeFamilyAndAlert(deps, session.family, session.userId);
  }
  throw new UnauthorizedException('Refresh token already used or expired');
}
