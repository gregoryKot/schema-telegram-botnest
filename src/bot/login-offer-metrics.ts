// Строка «Почта или VK ID для входа на сайт» в /stats — продолжение блока
// «Вход по коду» (LoginTicketMetricsService.render). Правило №8: карточка
// SiteAccessCard зовёт людей, открывающих приложение только в Telegram,
// добавить способ входа для сайта; без счёта не видно, доходит ли приглашение.
// Чистый форматтер + три счётчика через Prisma (сырого SQL нет).
//
// Язык простой: «увидели / пошли добавлять / отложили».
import type { PrismaService } from '../prisma/prisma.service';
import { plural } from './plural';

export interface LoginOfferMetrics {
  shown: number;
  open: number;
  later: number;
}

const TITLE = '✉️ <b>Почта или VK ID для входа на сайт</b> (за неделю)';

/** Текстовый блок для /stats. Чистая функция. */
export function formatLoginOffer(m: LoginOfferMetrics): string {
  const lines = [TITLE];
  if (m.shown + m.open + m.later === 0) {
    lines.push(
      'За неделю приглашение никому не показывали: либо в Telegram никто не ' +
        'заходил, либо у всех уже есть почта или VK ID.',
    );
    return lines.join('\n');
  }
  lines.push(
    `Приглашение увидели: ${m.shown} ` +
      `${plural(m.shown, 'раз', 'раза', 'раз')} (это показы, не люди)`,
  );
  lines.push(`Пошли добавлять: ${m.open}`);
  if (m.later > 0) lines.push(`Отложили: ${m.later}`);
  return lines.join('\n');
}

export async function loadLoginOffer(
  prisma: PrismaService,
): Promise<LoginOfferMetrics> {
  const since7 = new Date(Date.now() - 7 * 86_400_000);
  const count = (action: string) =>
    prisma.analyticsEvent.count({
      where: {
        name: 'login_method_offer',
        createdAt: { gte: since7 },
        meta: { path: ['action'], equals: action },
      },
    });
  const [shown, open, later] = await Promise.all([
    count('shown'),
    count('open'),
    count('later'),
  ]);
  return { shown, open, later };
}
