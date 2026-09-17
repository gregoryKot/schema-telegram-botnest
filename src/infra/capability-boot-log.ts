// Загрузочная сводка возможностей, зависящих от конфигурации (щит, волна 8).
// Вызывается ИЗ main.ts — намеренно НЕ из admin-alert.ts (тот файл никогда
// не зовёт Logger, см. его шапку). Мёртвая сигнализация (оба канала
// admin-alert.ts) — ERROR: без неё немы все рантайм-наблюдатели щита.
// Остальное выключенное — обычная info-строка «выключено: почему».
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

  // Мисконфиг адреса возврата OAuth — не просто «фича выключена», а готовый
  // цикл редиректов (2026-09-16): отдельная ERROR-строка, не info.
  const oauthSane = off.find((c) => c.id === 'oauthRedirectSane');
  if (oauthSane) logger.error(`Мисконфиг: ${oauthSane.offReason}`);

  for (const c of off) {
    // Оба алерт-канала — строкой выше; мисконфиг OAuth — тоже (error() выше).
    if (c.critical || c === oauthSane) continue;
    logger.log(`Выключено: ${c.offReason}`);
  }
}
