import { EVENT_RETENTION_DAYS } from '../analytics/analytics-retention';
import { plural } from './plural';

// Блок «Терапевты уходят» для /stats (правило №8). Событие therapist_resigned —
// терапевт отказался от роли (DELETE /api/therapy/therapist-role); его клиенты
// видят в приложении сообщение, а карты и задания остаются у них. Чистый
// форматтер, покрыт тестом, включая пустую БД. «За всё время» нет: события
// старше EVENT_RETENTION_DAYS удаляет pruneOld (analytics.service.ts).

export interface ExitTotals {
  /** Сколько разных терапевтов отказались от роли. */
  therapists: number;
  /** Сколько связей с клиентами при этом завершилось. */
  clients: number;
}

export interface TherapistExitMetrics {
  /** За EVENT_RETENTION_DAYS дней (старше — удалено). */
  window: ExitTotals;
  /** За последние 30 дней. */
  month: ExitTotals;
}

const people = (n: number) =>
  `${n} ${plural(n, 'человек', 'человека', 'человек')}`;

function line(t: ExitTotals): string {
  const clients =
    t.clients > 0
      ? `клиентов это коснулось: ${t.clients}`
      : 'клиентов это не коснулось';
  return `${people(t.therapists)}, ${clients}`;
}

/** Текстовый блок для /stats. Чистая функция. */
export function formatTherapistExitMetrics(m: TherapistExitMetrics): string {
  const lines = ['🚪 <b>Терапевты уходят</b>'];
  const n = EVENT_RETENTION_DAYS;
  const period = `За последние ${n} ${plural(n, 'день', 'дня', 'дней')}`;
  if (m.window.therapists === 0) {
    lines.push(`${period} никто не отказывался от роли терапевта.`);
    return lines.join('\n');
  }
  lines.push(`${period} отказались от роли терапевта: ${line(m.window)}.`);
  lines.push(
    m.month.therapists > 0
      ? `За последний месяц: ${line(m.month)}.`
      : 'За последний месяц — никто.',
  );
  return lines.join('\n');
}
