// Блок «Настройки» для /stats (правило №8: метрика, которой нет в отчёте, —
// невидима). Чистый форматтер поверх src/infra/capability-report.ts — щит,
// волна 8: класс «ветка, зависящая от конфигурации, деградирует МОЛЧА».
// Язык простой: «почта не отправляется — не задан RESEND_API_KEY», а не
// «RESEND_API_KEY undefined».
import {
  CapabilityStatus,
  isAlertChannelDead,
} from '../infra/capability-report';

export function formatCapabilityReport(report: CapabilityStatus[]): string {
  const off = report.filter((c) => !c.on);
  const title = '⚙️ <b>Настройки</b>';

  if (off.length === 0) {
    return `${title}: всё подключено, ничего не отключено.`;
  }

  const lines = [title];
  if (isAlertChannelDead(report)) {
    lines.push(
      '🔴 Алерты админу не уходят никуда: не настроены ни Telegram ' +
        '(BOT_TOKEN/ADMIN_ID), ни почта (RESEND_API_KEY/ADMIN_EMAIL) — ' +
        'сигнализация мертва.',
    );
  }
  for (const c of off) {
    // Мёртвая сигнализация уже сказана одной строкой выше — не повторяем
    // тот же факт дважды для обоих её каналов.
    if (c.critical) continue;
    lines.push(`• ${c.offReason}`);
  }
  return lines.join('\n');
}
