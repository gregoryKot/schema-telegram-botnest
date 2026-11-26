import type { Logger } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import type { BookingNotifyService } from '../booking/booking-notify.service';
import { markChargeFailed } from './subscription.charge-failed';

// Защиты продления подписки до и вокруг списания (chargeDue). Вынесено из
// subscription.charges.ts (правило №10).
//
// Аудит 2026-11, R8: `OK` от /Merchant/Recurring — «запрос принят», а не
// списание. Деньги подтверждает только вебхук ResultURL; отказ банка
// Robokassa вебхуком не присылает. Без сверки charge висел pending, подписка
// оставалась active на весь период без оплаты, владелец не знал. Сверки через
// OpState Robokassa нет (новая внешняя интеграция — правила №21 и №23), поэтому
// по таймауту: нет вебхука за сутки — неудача с алертом владельцу.
//
// Повторного списания при прошедшем платеже это не даёт, пока вебхук жив:
// поздний вебхук переводит failed → paid (activatePaidCharge) и ставит
// nextChargeAt на период вперёд, а повтор раньше 48 часов от попытки отсекает
// P-3 в chargeDue. Потерянный насовсем вебхук без OpState не отличить от
// отказа банка — об этом алерт.

/** Часть ChargeDeps (subscription.charges.ts), нужная защитам. */
export interface GuardDeps {
  prisma: PrismaService;
  notify: Pick<BookingNotifyService, 'alertAdmin'>;
  logger: Pick<Logger, 'log'>;
}

/** Сколько ждём вебхук после «запрос принят». */
export const WEBHOOK_WAIT_MS = 24 * 3_600_000;

/** Окно P-3: моложе этого pending/failed charge блокирует новое списание. */
export const RECENT_CHARGE_MS = 48 * 3_600_000;

/** Не подтверждённые вебхуком продления старше WEBHOOK_WAIT_MS → failed + алерт. */
export async function expireStaleCharges(
  deps: GuardDeps,
  maxFails: number,
  now = Date.now(),
): Promise<void> {
  const stale = await deps.prisma.subscriptionCharge.findMany({
    where: {
      status: 'pending',
      isFirst: false, // брошенная страница первой оплаты — не списание
      createdAt: { lt: new Date(now - WEBHOOK_WAIT_MS) },
    },
    take: 50,
  });
  for (const charge of stale) {
    const sub = await deps.prisma.subscription.findUnique({
      where: { id: charge.subscriptionId },
    });
    if (!sub) continue;
    const fails = sub.failedAttempts + 1;
    const counted = await markChargeFailed(deps.prisma, {
      chargeId: charge.id,
      subId: sub.id,
      status: sub.status,
      fails,
      maxFails,
      onlyPending: true,
    });
    if (!counted) continue; // вебхук успел между выборкой и пометкой
    await deps.notify.alertAdmin(
      `⚠️ <b>Подписка #${sub.id}: списание #${charge.id} не подтвердилось за сутки</b>\n` +
        `Robokassa приняла запрос, но об оплате не сообщила — считаем неудачей (${fails}/${maxFails}). ` +
        'Проверьте платёж в кабинете Robokassa: если деньги всё же списаны, следующая попытка примерно через сутки спишет второй раз.',
    );
  }
}

/**
 * P-3 (аудит 2026-07): если у подписки уже висит свежий pending-charge —
 * прошлое списание ушло в Robokassa, но webhook ещё не подтвердил его (или
 * процесс упал между chargeRecurring и update nextChargeAt). Второе реальное
 * списание в этой ситуации недопустимо — пропускаем и алертим. R8 (аудит
 * 2026-11): и failed моложе 48 ч — таймаут ответа Robokassa тоже failed, а
 * списание при этом могло пройти; ретрай «через сутки» дал бы второе. Свежий
 * failed — ожидаемая пауза перед повтором: без алерта.
 *
 * true — списывать сейчас нельзя.
 */
export async function recentChargeBlocks(
  deps: GuardDeps,
  subId: number,
  now = Date.now(),
): Promise<boolean> {
  const recent = await deps.prisma.subscriptionCharge.findFirst({
    where: {
      subscriptionId: subId,
      status: { in: ['pending', 'failed'] },
      createdAt: { gte: new Date(now - RECENT_CHARGE_MS) },
    },
  });
  if (!recent) return false;
  if (recent.status === 'pending') {
    await deps.notify.alertAdmin(
      `⚠️ <b>Подписка #${subId}: pending-charge #${recent.id} без подтверждения</b>\nНовое списание не отправлено. Проверьте статус в Robokassa.`,
    );
  } else {
    deps.logger.log(
      `Subscription ${subId}: неудачное списание #${recent.id} моложе 48 ч — повтор позже`,
    );
  }
  return true;
}
