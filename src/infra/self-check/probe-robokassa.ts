import { BookingStatus, SessionType } from '@prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { missingRobokassaVars } from '../../booking/robokassa-capability';
import { Probe, ProbeResult } from './types';

// Две пробы приёма оплаты (аудит 2026-10-11, правило №21). Площадку они НЕ
// вызывают: записанного ответа Robokassa у нас нет (правило №23), а выдумывать
// её эндпоинт нельзя. Проверяется то, что есть у нас: конфигурация и следы
// настоящих вебхуков ResultURL в собственной БД.
//
// 1. `robokassa` — конфигурация. В проде без ROBOKASSA_* платные пути отказывают
//    (payment-guard.ts), а ROBOKASSA_IS_TEST=true подтверждает бронь без денег.
//    Оба случая — авария. Попадает в /health (prod-smoke краснеет).
// 2. `paymentWebhooks` — живой сигнал. Платёж, начатый и не доведённый до
//    вебхука, — норма (человек передумал). Серия таких подряд без единой
//    оплаты после неё — нет: так выглядит сломанный адрес ResultURL или пароль 2.
//    Порог — по числу попыток, а не по времени: у практики с малым потоком
//    недели без оплат — норма, и временной порог красил бы пробу впустую.
//    В /health не попадает: отказ клиентов не должен ронять prod-smoke.
//    Учёт начинается с PAID_AT_TRACKED_SINCE: Booking.paidAt появился в
//    миграции 20261014100000, у старых броней он NULL даже там, где деньги
//    пришли, и считать их «попытками без вебхука» значило бы красить пробу
//    на брошенных холдах и отменённых оплатах за всю историю. Раньше этой даты
//    серия не считается — ни у броней, ни у донатов, ни у подписки: «подряд»
//    честно только внутри периода, где оплаты вообще записывались.
//    Ограничение: «попытка без вебхука» — платная бронь без paidAt (HELD,
//    CANCELLED). Так считаются и подтверждённая админом вручную, и
//    потом отменённая бронь, и бронь, где вебхук пришёл с расхождением суммы
//    (деньги есть, статус остаётся HELD, paidAt пуст). Ложный красный возможен
//    только в DM и в /stats; смотреть сначала список броней, потом ResultURL.

type Env = Record<string, string | undefined>;

/** Столько истёкших попыток подряд без единой оплаты — уже серия. */
export const SILENT_ATTEMPTS_LIMIT = 5;
/**
 * С этого момента Booking.paidAt заполняется вебхуком. Миграция влита в main
 * 2026-10-14 22:04 UTC (#650), деплой — после; берём ближайшую полночь, чтобы
 * не засчитать оплаченные в окне деплоя брони (paidAt у них ещё не писался).
 */
export const PAID_AT_TRACKED_SINCE = new Date('2026-10-15T00:00:00Z');
/** Холд брони живёт 15 минут: раньше попытка ещё может завершиться оплатой. */
const ATTEMPT_GRACE_MS = 15 * 60_000;

const isProd = (env: Env): boolean => env.NODE_ENV === 'production';

function configResult(env: Env): ProbeResult {
  if (!isProd(env)) return { ok: true, detail: 'не прод: автоподтверждение' };
  const missing = missingRobokassaVars(env);
  if (missing.length > 0) {
    return {
      ok: false,
      detail:
        'оплата не настроена — платные сессии и донаты отказывают ' +
        `(не заданы ${missing.join(', ')})`,
    };
  }
  if (env.ROBOKASSA_IS_TEST === 'true') {
    return {
      ok: false,
      detail: 'тестовый режим на проде — оплата проходит без денег',
    };
  }
  return { ok: true, detail: 'настроена, рабочий режим' };
}

export function robokassaConfigProbe(env: Env = process.env): Probe {
  return {
    id: 'robokassa',
    title: 'Приём оплаты (Robokassa): настройка',
    critical: false,
    run: () => Promise.resolve(configResult(env)),
  };
}

const ddmm = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}`;
};

export function paymentWebhooksProbe(
  prisma: PrismaService,
  env: Env = process.env,
  now: () => number = Date.now,
): Probe {
  return {
    id: 'paymentWebhooks',
    title: 'Приём оплаты (Robokassa): приходят ли подтверждения',
    critical: false,
    reportInHealth: false,
    async run() {
      if (!isProd(env)) return { ok: true, detail: 'не прод: пропущено' };
      if (missingRobokassaVars(env).length > 0) {
        return { ok: true, detail: 'оплата не настроена: см. пробу настройки' };
      }
      try {
        // paidAt у брони ставится только вебхуком (booking.service confirm).
        const [b, d, c] = await Promise.all([
          prisma.booking.aggregate({ _max: { paidAt: true } }),
          prisma.donation.aggregate({ _max: { paidAt: true } }),
          prisma.subscriptionCharge.aggregate({ _max: { paidAt: true } }),
        ]);
        const stamps = [b, d, c]
          .map((r) => r._max.paidAt)
          .filter((t): t is Date => t instanceof Date);
        const last = stamps.length
          ? new Date(Math.max(...stamps.map((t) => t.getTime())))
          : null;
        // Оплата до начала учёта границу не двигает и в тексте не называется:
        // счёт идёт с PAID_AT_TRACKED_SINCE, и дата старой оплаты вводила бы
        // в заблуждение («последняя оплата 30.06», а попытки считаны с 15.10).
        const paidInTrackedPeriod =
          last !== null && last > PAID_AT_TRACKED_SINCE;
        const from = paidInTrackedPeriod ? last : PAID_AT_TRACKED_SINCE;
        const createdAt = { gt: from, lt: new Date(now() - ATTEMPT_GRACE_MS) };
        const [nb, nd, nc] = await Promise.all([
          prisma.booking.count({
            where: {
              paidAt: null,
              type: { not: SessionType.INTRO_15 },
              status: { in: [BookingStatus.HELD, BookingStatus.CANCELLED] },
              createdAt,
            },
          }),
          prisma.donation.count({
            where: { paidAt: null, status: 'pending', createdAt },
          }),
          prisma.subscriptionCharge.count({
            where: {
              paidAt: null,
              status: 'pending',
              isFirst: true,
              createdAt,
            },
          }),
        ]);
        const attempts = nb + nd + nc;
        const since = paidInTrackedPeriod
          ? `последняя оплата ${ddmm(last)}`
          : `с начала учёта ${ddmm(PAID_AT_TRACKED_SINCE)} оплат не было`;
        if (attempts >= SILENT_ATTEMPTS_LIMIT) {
          return {
            ok: false,
            detail:
              `${attempts} попыток оплаты подряд без единого подтверждения ` +
              `от Robokassa (${since}) — возможно, неверен адрес ResultURL или пароль 2`,
          };
        }
        return {
          ok: true,
          detail:
            attempts === 0
              ? `неподтверждённых попыток нет (${since})`
              : `неподтверждённых попыток: ${attempts} из ${SILENT_ATTEMPTS_LIMIT} (${since})`,
        };
      } catch (e) {
        const msg = (e as Error)?.message?.slice(0, 150) ?? 'БД недоступна';
        return { ok: false, detail: `не удалось проверить оплаты: ${msg}` };
      }
    },
  };
}

export function robokassaProbes(prisma: PrismaService): Probe[] {
  return [robokassaConfigProbe(), paymentWebhooksProbe(prisma)];
}
