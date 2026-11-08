// Экран /settings: список часовых поясов, текст статуса и клавиатура.
// Отдельный файл, потому что telegram.settings.service.ts упирается в потолок
// 300 строк (правило №10 CLAUDE.md — раздутый файл дробится, а не пухнет
// дальше), а сборке экрана из сервиса нужен только BotService.
// Соседи и спеки берут buildSettingsView из telegram.settings.service.ts (ре-экспорт).
import { Markup } from 'telegraf';
import { BotService } from '../bot/bot.service';
import { CADENCE_LABELS } from '../notification/notification.cadence.service';
import { utcOffsetLabel } from '../notification/tz-offset';
import { NOTIFY_TIMEZONES } from '../notification/notify-timezones';
import { remindersOn } from '../notification/notify-toggles';
import { cityLabel } from '../booking/client-timezone';

// Кнопки пояса — общий список выбора (src/notification/notify-timezones.ts).
export const TIMEZONES = NOTIFY_TIMEZONES;

export function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Единый экран /settings: текст + клавиатура. Используется и суб-экранами. */
export async function buildSettingsView(
  botService: BotService,
  userId: bigint,
) {
  const s = await botService.getUserSettings(userId);
  if (!s) {
    return {
      text: 'Настройки не найдены.',
      keyboard: Markup.inlineKeyboard([]),
    };
  }
  const tz =
    TIMEZONES.find((t) => t.tz === s.notifyTimezone)?.label ??
    cityLabel(s.notifyTimezone);
  const utcLabel = utcOffsetLabel(s.notifyTimezone);
  const quietLine =
    s.notifyQuietStart === s.notifyQuietEnd
      ? 'выключены'
      : `${pad(s.notifyQuietStart)}:00 – ${pad(s.notifyQuietEnd)}:00`;
  const paused = s.notifyPausedUntil && s.notifyPausedUntil > new Date();
  const [isVy, reminders] = [s.addressForm === 'vy', remindersOn(s)];
  const lines = [
    '⚙️ Настройки уведомлений',
    '',
    `Напоминания: ${reminders ? '🔔 включены' : '🔕 выключены'}`,
    `Итоги дня: ${s.notifySummaryEnabled === false ? 'выключены' : 'включены'}`,
    ...(paused
      ? [
          `⏸ На паузе до ${s.notifyPausedUntil!.toLocaleDateString('ru-RU', { timeZone: s.notifyTimezone })}`,
        ]
      : []),
    `Время: ${pad(s.notifyLocalHour)}:00`,
    `Частота: ${CADENCE_LABELS[s.notifyFrequency ?? 0] ?? CADENCE_LABELS[0]}`,
    `Игровой режим: ${s.notifyGamified ? '🎮 включён' : 'выключен'}`,
    `Тихие часы: ${quietLine}`,
    `Часовой пояс: ${tz} (${utcLabel})`,
    `Обращение: на «${isVy ? 'вы' : 'ты'}»`,
  ];
  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback(
        reminders ? '🔕 Выключить напоминания' : '🔔 Включить напоминания',
        'settings:toggle',
      ),
    ],
    [Markup.button.callback('🕐 Изменить время', 'settings:pick_hour')],
    [Markup.button.callback('🔁 Частота напоминаний', 'settings:pick_freq')],
    [
      Markup.button.callback(
        s.notifyGamified ? '🎮 Игровой режим: выкл' : '🎮 Игровой режим: вкл',
        'settings:toggle_gamified',
      ),
    ],
    [Markup.button.callback('🌙 Тихие часы', 'settings:pick_quiet')],
    [Markup.button.callback('🌍 Изменить часовой пояс', 'settings:pick_tz')],
    [
      Markup.button.callback(
        isVy ? 'Перейти на «ты»' : 'Перейти на «вы»',
        `settings:addr:${isVy ? 'ty' : 'vy'}`,
      ),
    ],
  ]);
  return { text: lines.join('\n'), keyboard };
}
