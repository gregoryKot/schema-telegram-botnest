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
// Кнопка «⏰ Напомню через час» — здесь же (аудит 2026-10, backend#16): рестарт
// стирал отложенные напоминания, и заметил это человек. Теперь видно, сколько
// раз отложили (событие reminder_snoozed) и сколько отложенных пришло.
//
// Язык простой: «Telegram попросил подождать», а не «429 rate limit».
import { plural } from './plural';

export interface QueueTotals {
  /** Прогонов очереди, в которых было что слать. */
  ticks: number;
  sent: number;
  /** Из ушедших — уведомлением в приложение (веб-пуш), а не в Telegram. */
  pushed: number;
  /** Не ушло из-за сбоя (наша ошибка или сеть); повтор в следующий заход. */
  transient: number;
  /** Сколько раз Telegram попросил подождать, и после ожидания ушло. */
  waited: number;
  /** Отложено на следующий заход: лимит Telegram или кончилось время. */
  deferred: number;
}

/** «Напомню через час» за неделю. */
export interface SnoozeTotals {
  /** Сколько раз нажали (только строки, которые написал бот). */
  snoozed: number;
  /** Из них час попал в тихие часы — перенесено к их концу. */
  quietShift: number;
  /** Отложенные напоминания, которые пришли. */
  delivered: number;
  /** Отменены до отправки: дневник уже заполнен, пауза, «реже». */
  cancelled: number;
}

export interface NotifyQueueMetrics {
  day: QueueTotals;
  week: QueueTotals;
  snooze: SnoozeTotals;
}

const times = (n: number) => `${n} ${plural(n, 'раз', 'раза', 'раз')}`;

function failShare(t: QueueTotals): string {
  if (t.transient === 0) return 'сбоев не было';
  const pct = Math.round((t.transient / (t.sent + t.transient)) * 100);
  return `не ушло из-за сбоя ${t.transient} (${pct}%)`;
}

const SNOOZE = 'Кнопкой «⏰ Напомню через час»';
const snoozeUsed = (s: SnoozeTotals) =>
  s.snoozed + s.delivered + s.cancelled > 0;

function snoozeLine(s: SnoozeTotals): string {
  if (!snoozeUsed(s)) return `${SNOOZE} за неделю не пользовались.`;
  const quiet =
    s.quietShift > 0 ? `, из них ${s.quietShift} — к концу тихих часов` : '';
  const notNeeded =
    s.cancelled > 0
      ? `, не понадобилось ${s.cancelled} (дневник уже заполнен или пауза)`
      : '';
  return `${SNOOZE} за неделю отложили ${times(s.snoozed)}${quiet}. Пришло ${s.delivered}${notNeeded}.`;
}

/** Текстовый блок для /stats. Чистая функция. */
export function formatNotifyQueueMetrics(m: NotifyQueueMetrics): string {
  const lines = ['📬 <b>Напоминания из бота</b>'];
  if (m.week.ticks === 0) {
    lines.push('За неделю напоминаний из очереди не было.');
    if (snoozeUsed(m.snooze)) lines.push(snoozeLine(m.snooze));
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
  const app = w.pushed > 0 ? ` (из них в приложение ${w.pushed})` : '';
  lines.push(
    `За неделю ушло ${w.sent}${app}, ${failShare(w)}; ` +
      `Telegram просил подождать ${times(w.waited)}, ` +
      `отложено ${w.deferred}.`,
  );
  lines.push(snoozeLine(m.snooze));
  return lines.join('\n');
}
