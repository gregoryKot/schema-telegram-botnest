// Загрузочная сводка возможностей, зависящих от конфигурации (щит, волна 8).
// Вызывается ИЗ main.ts — намеренно НЕ из admin-alert.ts: тот файл никогда не
// зовёт NestJS Logger (см. его шапку — иначе e-mail-фолбэк логировал бы
// ошибку, которая рекурсивно уходит обратно через AlertLogger).
//
// Если сигнализация (оба канала admin-alert.ts) мертва целиком — это ERROR:
// без неё немы все рантайм-наблюдатели волн 2/3/7 (события безопасности,
// сбои платежей, сбои канала). Остальные выключенные возможности — обычная
// info-строка «выключено: почему», их отсутствие не означает, что молчит и
// система оповещения о поломках.
import type { Logger } from '@nestjs/common';
import { buildCapabilityReport, isAlertChannelDead } from './capability-report';

type Env = Record<string, string | undefined>;
type LoggerLike = Pick<Logger, 'log' | 'error'>;

export function logCapabilityReport(
  logger: LoggerLike,
  env: Env = process.env,
): void {
  const report = buildCapabilityReport(env);
  const off = report.filter((c) => !c.on);

  if (off.length === 0) {
    logger.log(
      'Возможности, зависящие от конфигурации: всё подключено, выключенных нет.',
    );
    return;
  }

  if (isAlertChannelDead(report)) {
    logger.error(
      'Сигнализация мертва: ни Telegram (BOT_TOKEN/ADMIN_ID), ни почта ' +
        '(RESEND_API_KEY/ADMIN_EMAIL) не настроены — единая точка алертов из ' +
        'src/utils/admin-alert.ts молча теряет ВСЕ алерты (события безопасности, ' +
        'сбои платежей, сбои канала). Задай хотя бы один канал.',
    );
  }

  for (const c of off) {
    // Оба алерт-канала при мёртвой сигнализации уже покрыты строкой выше —
    // не дублируем тем же фактом два раза.
    if (c.critical) continue;
    logger.log(`Выключено: ${c.offReason}`);
  }
}
