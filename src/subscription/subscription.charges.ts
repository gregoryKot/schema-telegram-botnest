import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RobokassaService } from '../booking/robokassa.service';
import { BookingNotifyService } from '../booking/booking-notify.service';
import { SubPeriod } from '../booking/booking.config';
import { decryptRecord, EncryptSchema } from '../utils/crypto';
import { SUBSCRIPTION_INVID_BASE } from './subscription.constants';

// Списания по подписке: подтверждение оплаченного charge из вебхука и
// почасовой прогон due-подписок. Вынесено из subscription.service.ts
// (правило №10) — сервис оставляет тонкие делегаты.

const SCHEMA: EncryptSchema = { strings: ['email'] };
const MAX_FAILS = 3; // after this many failed recurring charges → past_due

export interface ChargeDeps {
  prisma: PrismaService;
  robokassa: RobokassaService;
  notify: BookingNotifyService;
  logger: Logger;
  enabled: boolean;
}

export async function markChargePaid(
  deps: ChargeDeps,
  invId: number,
  paidAmount?: number,
) {
  const chargeId = invId - SUBSCRIPTION_INVID_BASE;
  const charge = await deps.prisma.subscriptionCharge.findUnique({
    where: { id: chargeId },
  });
  if (!charge || charge.status === 'paid') return { ok: true };

  const sub = await deps.prisma.subscription.findUnique({
    where: { id: charge.subscriptionId },
  });
  if (!sub) return { ok: true };

  // Defense in depth: signature already binds the amount, but flag any mismatch.
  // Здесь (в отличие от booking.confirm) не блокируем: сумма подписана
  // Robokassa нашим же счётом, юзер оплатил легитимно выставленное —
  // расхождение означает рассинхрон прайса и требует ручного решения,
  // а не отказа юзеру в оплаченном сервисе.
  if (paidAmount != null && Math.round(paidAmount) !== charge.amount) {
    await deps.notify.alertAdmin(
      `⚠️ <b>Подписка #${sub.id}: сумма расходится</b>\nОжидали ${charge.amount} ₽, оплатили ${paidAmount} ₽. Проверьте вручную.`,
    );
  }

  // P-2 (аудит 2026-07): атомарный CAS по статусу charge — параллельные
  // ретраи webhook не задваивают активацию/алерты: выигрывает один вызов.
  const claimed = await deps.prisma.subscriptionCharge.updateMany({
    where: { id: chargeId, status: { not: 'paid' } },
    data: { status: 'paid', paidAt: new Date() },
  });
  if (claimed.count === 0) return { ok: true };

  const next = addPeriod(new Date(), sub.period as SubPeriod);
  await deps.prisma.subscription.update({
    where: { id: sub.id },
    data: {
      status: 'active',
      lastChargeAt: new Date(),
      nextChargeAt: next,
      failedAttempts: 0,
      // The first paid charge becomes the PreviousInvoiceID for all future charges.
      ...(charge.isFirst ? { firstInvId: invId } : {}),
    },
  });

  const plain = decryptRecord(sub, SCHEMA);
  await deps.notify.alertAdmin(
    `${charge.isFirst ? '🎉 <b>Новая подписка</b>' : '🔁 <b>Продление подписки</b>'} ${sub.amount} ₽/${sub.period === 'year' ? 'год' : 'мес'}` +
      (plain.email ? `\n📬 ${plain.email}` : '') +
      (sub.telegramId ? `\n👤 tg:${sub.telegramId}` : ''),
  );
  deps.logger.log(
    `Subscription ${sub.id} ${charge.isFirst ? 'ACTIVATED' : 'RENEWED'} → next ${next.toISOString()}`,
  );
  return { ok: true };
}

/** Charge subscriptions whose next charge is due. Runs hourly (см. сервис). */
export async function chargeDue(deps: ChargeDeps) {
  if (!deps.enabled || !deps.robokassa.enabled) return;
  const due = await deps.prisma.subscription.findMany({
    where: {
      status: { in: ['active', 'past_due'] },
      nextChargeAt: { lte: new Date() },
      firstInvId: { not: null },
    },
    take: 50,
  });
  for (const sub of due) {
    // P-3 (аудит 2026-07): если у подписки уже висит свежий pending-charge —
    // прошлое списание ушло в Robokassa, но webhook ещё не подтвердил его
    // (или процесс упал между chargeRecurring и update nextChargeAt).
    // Второе реальное списание в этой ситуации недопустимо — пропускаем и алертим.
    const pending = await deps.prisma.subscriptionCharge.findFirst({
      where: {
        subscriptionId: sub.id,
        status: 'pending',
        createdAt: { gte: new Date(Date.now() - 48 * 3_600_000) },
      },
    });
    if (pending) {
      await deps.notify.alertAdmin(
        `⚠️ <b>Подписка #${sub.id}: pending-charge #${pending.id} без подтверждения</b>\nНовое списание не отправлено. Проверьте статус в Robokassa.`,
      );
      continue;
    }
    const charge = await deps.prisma.subscriptionCharge.create({
      data: { subscriptionId: sub.id, amount: sub.amount },
    });
    const res = await deps.robokassa.chargeRecurring({
      invId: SUBSCRIPTION_INVID_BASE + charge.id,
      previousInvId: sub.firstInvId!,
      amount: sub.amount,
      desc: `Подписка SchemeHappens (${sub.period === 'year' ? 'год' : 'месяц'})`,
    });
    if (res.ok) {
      // Advance nextChargeAt NOW (not only on the webhook): the queue runs
      // hourly, so if the success webhook is delayed or lost we'd otherwise
      // re-pick this subscription and charge it again. The webhook still
      // confirms the charge (marks it paid, resets fails) idempotently.
      await deps.prisma.subscription.update({
        where: { id: sub.id },
        data: {
          nextChargeAt: addPeriod(new Date(), sub.period as SubPeriod),
        },
      });
      deps.logger.log(
        `Subscription ${sub.id} recurring charge sent (InvId=${SUBSCRIPTION_INVID_BASE + charge.id})`,
      );
    } else {
      const fails = sub.failedAttempts + 1;
      await deps.prisma.$transaction([
        deps.prisma.subscriptionCharge.update({
          where: { id: charge.id },
          data: { status: 'failed' },
        }),
        deps.prisma.subscription.update({
          where: { id: sub.id },
          data: {
            failedAttempts: fails,
            status: fails >= MAX_FAILS ? 'past_due' : sub.status,
            // Retry in a day unless we've given up.
            nextChargeAt:
              fails >= MAX_FAILS ? null : new Date(Date.now() + 24 * 3_600_000),
          },
        }),
      ]);
      await deps.notify.alertAdmin(
        `⚠️ <b>Не удалось списать подписку #${sub.id}</b> (${fails}/${MAX_FAILS})\n${res.body.slice(0, 150)}`,
      );
    }
  }
  if (due.length)
    deps.logger.log(`Processed ${due.length} due subscription(s)`);
}

/** Add one billing period to a date. */
function addPeriod(d: Date, period: SubPeriod): Date {
  const r = new Date(d);
  if (period === 'year') r.setUTCFullYear(r.getUTCFullYear() + 1);
  else r.setUTCMonth(r.getUTCMonth() + 1);
  return r;
}
