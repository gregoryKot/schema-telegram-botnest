// Часы напоминания, которые бот предлагает кнопками (settings:pick_hour).
// Это же — allow-list обработчика settings:hour:<n>: клавиатура и проверка
// берутся из одной константы, чтобы не разойтись (правило №4). Сайт принимает
// 0–23 (UpdateSettingsDto), бот — только то, что нарисовал сам: подделанный
// callback_data (24, 99) иначе сломал бы планирование уже после сохранения.
import { Markup } from 'telegraf';
import { pad } from './telegram.settings.view';

export const REMINDER_HOURS: readonly number[] = [
  8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
];

const HOURS_PER_ROW = 4;

/** Ряды кнопок выбора часа: по четыре в ряд, callback_data `settings:hour:<h>`. */
export function buildHourRows(): ReturnType<typeof Markup.button.callback>[][] {
  const rows: ReturnType<typeof Markup.button.callback>[][] = [];
  for (let i = 0; i < REMINDER_HOURS.length; i += HOURS_PER_ROW) {
    rows.push(
      REMINDER_HOURS.slice(i, i + HOURS_PER_ROW).map((h) =>
        Markup.button.callback(`${pad(h)}:00`, `settings:hour:${h}`),
      ),
    );
  }
  return rows;
}
