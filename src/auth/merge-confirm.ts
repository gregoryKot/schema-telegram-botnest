import {
  BadRequestException,
  ForbiddenException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import type { MergeService } from './merge.service';
import type { TotpService } from './totp.service';

// Проверки подтверждения объединения аккаунтов (POST /api/auth/merge) —
// вынесены из auth-account.controller.ts (правило №10: контроллер у потолка).

/** Машиночитаемая причина 403 — по ней фронт показывает поле для кода. */
export const SOURCE_TOTP_REQUIRED = 'source_totp_required';

// Вызывающий обязан ДОКАЗАТЬ, что он target. Анонимный держатель merge-токена
// не годится: токен выдаётся на OAuth-колбэке тому, кто прошёл вход у
// провайдера, и «подписан» он лишь для того, чтобы его нельзя было подделать,
// а не чтобы им мог воспользоваться кто угодно (аудит 2026-10, A2).
export function assertMergeCaller(
  callerId: bigint | null,
  target: bigint,
): void {
  if (callerId === null || callerId !== target) {
    throw new UnauthorizedException(
      'Merge token does not match current session',
    );
  }
}

// Второй фактор поглощаемого аккаунта. Проверяем в момент подтверждения, а не
// при выдаче токена: TOTP могли включить за 10 минут жизни токена. Один и тот
// же отказ и для «кода нет», и для «код не подошёл» — не подсказываем, что
// именно не так (перебор ограничен троттлингом эндпоинта).
export async function assertSourceTotp(
  totp: Pick<TotpService, 'isEnabled' | 'verifyCode'>,
  source: bigint,
  code: string | undefined,
): Promise<void> {
  if (!(await totp.isEnabled(source))) return;
  const ok = code ? await totp.verifyCode(source, code) : false;
  if (!ok) {
    throw new ForbiddenException({
      message: 'Нужен код двухфакторной защиты объединяемого аккаунта',
      reason: SOURCE_TOTP_REQUIRED,
    });
  }
}

// Перенос данных source → target. Полная ошибка уходит в лог/алерт админу,
// клиенту — дружелюбный текст без внутренностей Prisma.
export async function mergeOrThrow(
  merge: Pick<MergeService, 'merge'>,
  logger: Logger,
  source: bigint,
  target: bigint,
): Promise<void> {
  try {
    await merge.merge(source, target);
  } catch (err) {
    const msg = (err as Error).message ?? 'merge failed';
    logger.error(
      `merge ${source} → ${target} failed: ${msg}`,
      (err as Error).stack,
    );
    throw new BadRequestException(
      'Не удалось объединить аккаунты. Админ уведомлён — попробовать позже.',
    );
  }
}
