// Блок «Напоминания из бота» для /stats (правило №8: метрика, которой нет в
// отчёте, — невидима). Чистый форматтер, покрыт тестом, включая пустую БД.
//
// Зачем блок есть. Аудит 2026-10: очередь уведомлений слала подряд до 500
// сообщений и не слушала ответ Telegram «слишком часто» (429). Сбой отправки
// строку не помечает и следа в базе не оставляет — сколько напоминаний не
// ушло, не знал никто. Теперь каждый прогон очереди пишет свои числа
// (событие notify_queue_tick), и здесь видно: сколько ушло, сколько упало,
// сколько раз Telegram попросил подождать и сколько перенесено на следующий
// заход.
//
// Язык простой: «Telegram попросил подождать», а не «429 rate limit».
import { plural } from './plural';

export interface QueueTotals {
  /** Прогонов очереди, в которых было что слать. */
  ticks: number;
  sent: number;
  /** Не ушло из-за сбоя (наша ошибка или сеть); повтор в следующий заход. */
  transient: number;
  /** Сколько раз Telegram попросил подождать, и после ожидания ушло. */
  waited: number;
  /** Отложено на следующий заход: лимит Telegram или кончилось время. */
  deferred: number;
}

export interface NotifyQueueMetrics {
  day: QueueTotals;
  week: QueueTotals;
}

const times = (n: number) => `${n} ${plural(n, 'раз', 'раза', 'раз')}`;

function failShare(t: QueueTotals): string {
  if (t.transient === 0) return 'сбоев не было';
  const pct = Math.round((t.transient / (t.sent + t.transient)) * 100);
  return `не ушло из-за сбоя ${t.transient} (${pct}%)`;
}

/** Текстовый блок для /stats. Чистая функция. */
export function formatNotifyQueueMetrics(m: NotifyQueueMetrics): string {
  const lines = ['📬 <b>Напоминания из бота</b>'];
  if (m.week.ticks === 0) {
    lines.push('За неделю напоминаний из очереди не было.');
    return lines.join('\n');
  }
  const d = m.day;
  if (d.ticks === 0) {
    lines.push('За сутки напоминаний не было.');
  } else {
    lines.push(`За сутки ушло ${d.sent}, ${failShare(d)}.`);
    if (d.waited > 0 || d.deferred > 0) {
      lines.push(
        `Telegram попросил подождать: ${times(d.waited)}; ` +
          `отложено на следующий заход: ${d.deferred}.`,
      );
    } else {
      lines.push('Telegram ни разу не просил подождать.');
    }
  }
  const w = m.week;
  lines.push(
    `За неделю ушло ${w.sent}, ${failShare(w)}; ` +
      `Telegram просил подождать ${times(w.waited)}, ` +
      `отложено ${w.deferred}.`,
  );
  return lines.join('\n');
}
