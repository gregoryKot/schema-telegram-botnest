// Строка очереди → уведомление в приложение (веб-пуш, src/push/). Вынесено
// из telegram.schedule-queue.ts (правило №10): у пуша свои исходы.
//
// Канал выбран до этого шага (notify-channel.ts), пауза/бюджет/тихие часы
// проверены (holdBeforeSend) — одинаково для обоих каналов. Исходы:
//   sent    → markSent;
//   unknown → markSent (push-сервис мог принять, повтор дал бы дубль) и в
//             общую строку лога про неизвестный исход;
//   failed  → строка остаётся на следующий тик; после MAX_REJECTS неудач
//             подряд снимается (cancelOne — не «отправлено»: каденс считает
//             только реально ушедшие), счётчик тот же, что у отказов Telegram;
//   gone    → подписок не осталось: в этом же проходе — в Telegram, если он
//             привязан, иначе «некому доставить».
// markUserBlocked отсюда не зовётся никогда: человек бота не блокировал.
import type { DueNotification } from '../notification/notification.service';
import type { SendSettings } from '../bot/send-settings';
import { toPushPayload } from '../push/push-payload';
import type { QueueDeps } from './telegram.schedule-queue';
import { renderForQueue } from './telegram.schedule-queue.render';
import { MAX_REJECTS } from './telegram.schedule-queue.rejects';
import type { QueueTick } from './telegram.schedule-queue.tally';

/** done — строка решена; telegram — слать в Telegram; stop — бюджет вышел. */
export type PushStep = 'done' | 'telegram' | 'stop';

export async function sendRowByPush(
  deps: QueueDeps,
  notif: DueNotification,
  s: SendSettings,
  tick: QueueTick,
  left: number,
  seen: { unknown: number[]; transient: number },
): Promise<PushStep> {
  const { push, notificationService, logger } = deps;
  if (!push) return 'telegram';
  if (!tick.hasTime(left)) return 'stop';
  const msg = await renderForQueue(deps, notif, s.form);
  if (!msg) return 'done';
  const payload = toPushPayload(notif.type, msg.text, msg.extra?.reply_markup);
  const outcome = await push.sendToUser(notif.userId, payload);
  if (outcome === 'gone') return 'telegram';
  if (outcome === 'sent') {
    await notificationService.markSent(notif.id);
    tick.notePushed();
  } else if (outcome === 'unknown') {
    await notificationService.markSent(notif.id);
    seen.unknown.push(notif.id);
  } else {
    seen.transient++;
    if (deps.rejects.strike(notif.id)) {
      await notificationService.cancelOne(notif.id);
      logger.warn(
        `Notification id=${notif.id}: уведомление в приложение не принято ${MAX_REJECTS} раза подряд — снято`,
      );
    }
  }
  return 'done';
}
