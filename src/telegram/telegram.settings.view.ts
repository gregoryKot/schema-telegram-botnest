// Экран /settings: список часовых поясов, текст статуса и клавиатура.
// Отдельный файл, потому что telegram.settings.service.ts упирается в потолок
// 300 строк (правило №10 CLAUDE.md — раздутый файл дробится, а не пухнет
// дальше), а сборке экрана из сервиса нужен только BotService.
// Соседи (telegram.notify-settings.service.ts и спеки) по-прежнему берут
// buildSettingsView из telegram.settings.service.ts — там стоит ре-экспорт.
import { Markup } from 'telegraf';
import { BotService } from '../bot/bot.service';
import { CADENCE_LABELS } from '../notification/notification.cadence.service';
import { tzOffsetAt } from '../notification/notification.time';

export const TIMEZONES: { label: string; tz: string }[] = [
  { label: 'Лос-Анджелес', tz: 'America/Los_Angeles' },
  { label: 'Нью-Йорк', tz: 'America/New_York' },
  { label: 'Лондон', tz: 'Europe/London' },
  { label: 'Берлин, Варшава', tz: 'Europe/Berlin' },
  { label: 'Киев', tz: 'Europe/Kyiv' },
  { label: 'Израиль', tz: 'Asia/Jerusalem' },
  { label: 'Москва', tz: 'Europe/Moscow' },
  { label: 'Дубай', tz: 'Asia/Dubai' },
  { label: 'Ташкент', tz: 'Asia/Tashkent' },
  { label: 'Алматы', tz: 'Asia/Almaty' },
  { label: 'Пекин', tz: 'Asia/Shanghai' },
];

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
    TIMEZONES.find((t) => t.tz === s.notifyTimezone)?.label ?? s.notifyTimezone;
  const offset = tzOffsetAt(s.notifyTimezone);
  const utcLabel = offset >= 0 ? `UTC+${offset}` : `UTC${offset}`;
  const quietLine =
    s.notifyQuietStart === s.notifyQuietEnd
      ? 'выключены'
      : `${pad(s.notifyQuietStart)}:00 – ${pad(s.notifyQuietEnd)}:00`;
  const paused = s.notifyPausedUntil && s.notifyPausedUntil > new Date();
  const isVy = s.addressForm === 'vy';
  const lines = [
    '⚙️ Настройки уведомлений',
    '',
    `Статус: ${s.notifyEnabled ? '🔔 Включены' : '🔕 Выключены'}`,
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
        s.notifyEnabled ? '🔕 Выключить' : '🔔 Включить',
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
