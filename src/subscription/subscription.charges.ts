import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RobokassaService } from '../booking/robokassa.service';
import { BookingNotifyService } from '../booking/booking-notify.service';
import { SubPeriod } from '../booking/booking.config';
import { decryptRecord, EncryptSchema } from '../utils/crypto';
import { SUBSCRIPTION_INVID_BASE } from './subscription.constants';
import {
  chargeFailedText,
  subscriptionChargedAlert,
} from './subscription-owner-card';
import { moneyAlert } from '../logger/money-alert';
import { activatePaidCharge } from './subscription.charge-activate';
import { markChargeFailed } from './subscription.charge-failed';
import { reportPaidAfterCancel } from './subscription-paid-after-cancel';
import {
  expireStaleCharges,
  recentChargeBlocks,
} from './subscription.charge-guards';

// Списания по подписке: подтверждение оплаченного charge из вебхука и
// почасовой прогон due-подписок (сервис оставляет тонкие делегаты).

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
  // R9 (аудит 2026-11): деньги пришли, а записи нет — OK Robokassa (повтор её
  // не создаст), владельцу — error() со стабильным текстом (DM с троттлингом).
  const lost = (what: string) =>
    moneyAlert(
      `Robokassa: оплата подписки, InvId ${invId} (${paidAmount ?? '?'} ₽), без строки ${what} в БД — нужна ручная проверка`,
    );
  if (!charge) {
    deps.logger.error(lost('списания'));
    return { ok: true };
  }
  if (charge.status === 'paid') return { ok: true };

  const sub = await deps.prisma.subscription.findUnique({
    where: { id: charge.subscriptionId },
  });
  if (!sub) {
    deps.logger.error(lost('подписки'));
    return { ok: true };
  }

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

  const next = addPeriod(new Date(), sub.period as SubPeriod);
  const outcome = await activatePaidCharge(deps.prisma, {
    chargeId,
    subId: sub.id,
    isFirst: charge.isFirst,
    invId,
    next,
  });
  if (outcome === 'skip') return { ok: true };

  const plain = decryptRecord(sub, SCHEMA);
  if (outcome === 'cancelled') {
    await reportPaidAfterCancel(deps, plain, charge, paidAmount);
    return { ok: true };
  }
  const alert = subscriptionChargedAlert(plain, charge);
  await deps.notify.notifyAdminBoth(alert.html, alert.subject);
  deps.logger.log(
    `Subscription ${sub.id} ${charge.isFirst ? 'ACTIVATED' : 'RENEWED'} → next ${next.toISOString()}`,
  );
  return { ok: true };
}

/** Charge subscriptions whose next charge is due. Runs hourly (см. сервис). */
export async function chargeDue(deps: ChargeDeps) {
  if (!deps.enabled || !deps.robokassa.enabled) return;
  await expireStaleCharges(deps, MAX_FAILS);
  const due = await deps.prisma.subscription.findMany({
    where: {
      status: { in: ['active', 'past_due'] },
      nextChargeAt: { lte: new Date() },
      firstInvId: { not: null },
    },
    take: 50,
  });
  for (const sub of due) {
    // P-3: свежий pending или failed — второе списание недопустимо.
    if (await recentChargeBlocks(deps, sub.id)) continue;
    // Атомарный захват подписки ДО обращения в Robokassa. Проверка
    // pending-charge выше защищает от потерянного вебхука, но не от второго
    // инстанса: два процесса читают findMany одновременно, оба видят «pending
    // нет» и оба списывают — окно между проверкой и созданием charge. UPDATE
    // с условием `nextChargeAt <= now()` атомарен в Postgres: строку заберёт
    // ровно один, второй получит 0 обновлённых и уйдёт дальше по списку.
    //
    // Цена — компромисс в пользу клиента: если процесс упадёт между захватом
    // и списанием, платёж пропустится (nextChargeAt уже сдвинут), а не
    // спишется дважды. Ровно ту же сторону выбирает защита P-3 выше.
    const claimed = await deps.prisma.$executeRaw`
      UPDATE "Subscription"
      SET "nextChargeAt" = ${addPeriod(new Date(), sub.period as SubPeriod)}
      WHERE id = ${sub.id} AND "nextChargeAt" <= ${new Date()}
    `;
    if (claimed === 0) {
      deps.logger.log(
        `Subscription ${sub.id}: списание уже забрал другой обработчик — пропуск`,
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
      // OK — «запрос принят», не списание (R8): charge остаётся pending до
      // вебхука, без него через сутки его закроет expireStaleCharges
      // (subscription.charge-guards.ts).
      // nextChargeAt уже сдвинут захватом выше — отдельный UPDATE не нужен;
      // сдвиг — точка сериализации между инстансами.
      deps.logger.log(
        `Subscription ${sub.id}: Robokassa приняла запрос на списание (InvId=${SUBSCRIPTION_INVID_BASE + charge.id}), ждём вебхук`,
      );
    } else {
      const fails = sub.failedAttempts + 1;
      const counted = await markChargeFailed(deps.prisma, {
        chargeId: charge.id,
        subId: sub.id,
        status: sub.status,
        fails,
        maxFails: MAX_FAILS,
      });
      if (!counted) {
        deps.logger.log(
          `Subscription ${sub.id}: charge ${charge.id} уже оплачен вебхуком — сбой не засчитан`,
        );
        continue;
      }
      // Ответ Robokassa — в лог (warn: error ушёл бы владельцу в Telegram).
      deps.logger.warn(`Subscription ${sub.id}: charge failed: ${res.body}`);
      await deps.notify.alertAdmin(
        chargeFailedText(sub.id, charge.id, fails, MAX_FAILS),
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
