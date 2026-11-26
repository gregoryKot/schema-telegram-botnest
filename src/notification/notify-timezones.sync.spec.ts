// Список поясов выбора живёт двумя копиями: бэкенд (кнопки бота, валидация
// настроек) и shared/ (выбор на сайте и в мини-аппе) — бэкенд не импортирует
// shared/. До QA 2026-11-03 списков было три, и они разошлись: на сайте был
// «Киев / Израиль» без Израиля в бэкенде, ни в одном — России восточнее
// Москвы. Правило №4: два места, обязанные совпадать, сверяет тест.
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  NOTIFY_TIMEZONES,
  VALID_TIMEZONES,
  isNotifyTimezone,
} from './notify-timezones';
import { tzOffsetAt } from './notification.time';

const SHARED_PATH = join(
  __dirname,
  '..',
  '..',
  'shared',
  'src',
  'settings',
  'timezones.ts',
);

/** Пары (iana, city) из литерала NOTIFY_TIMEZONE_CITIES без компиляции TS. */
function parseShared(): Array<{ tz: string; label: string }> {
  const src = readFileSync(SHARED_PATH, 'utf8');
  const body = src.match(/NOTIFY_TIMEZONE_CITIES[\s\S]*?=\s*\[([\s\S]*?)\n\];/);
  if (!body)
    throw new Error('Не нашёл NOTIFY_TIMEZONE_CITIES в ' + SHARED_PATH);
  return [...body[1].matchAll(/iana:\s*'([^']+)',\s*city:\s*'([^']+)'/g)].map(
    (m) => ({ tz: m[1], label: m[2] }),
  );
}

describe('notify-timezones ↔ shared/src/settings/timezones', () => {
  it('тот же набор поясов, те же названия, тот же порядок', () => {
    expect(parseShared()).toEqual([...NOTIFY_TIMEZONES]);
  });

  it('контроль парсера: список не пуст (пустой совпал бы с пустым)', () => {
    expect(parseShared().length).toBeGreaterThan(10);
  });
});

describe('NOTIFY_TIMEZONES', () => {
  const at = new Date('2026-01-15T12:00:00Z');

  it('Россия от Калининграда до Камчатки и Алматы по UTC+5 (с 01.03.2024)', () => {
    const offsets = Object.fromEntries(
      NOTIFY_TIMEZONES.map((t) => [t.tz, tzOffsetAt(t.tz, at)]),
    );
    expect(offsets).toMatchObject({
      'Europe/Kaliningrad': 2,
      'Europe/Samara': 4,
      'Asia/Yekaterinburg': 5,
      'Asia/Almaty': 5,
      'Asia/Omsk': 6,
      'Asia/Novosibirsk': 7,
      'Asia/Krasnoyarsk': 7,
      'Asia/Irkutsk': 8,
      'Asia/Yakutsk': 9,
      'Asia/Vladivostok': 10,
      'Asia/Magadan': 11,
      'Asia/Kamchatka': 12,
    });
  });

  it('порядок — запад → восток (по зимнему смещению)', () => {
    const offsets = NOTIFY_TIMEZONES.map((t) => tzOffsetAt(t.tz, at));
    expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
  });

  it('каждый пояс — настоящий IANA, VALID_TIMEZONES — тот же список', () => {
    for (const t of NOTIFY_TIMEZONES) expect(isNotifyTimezone(t.tz)).toBe(true);
    expect(VALID_TIMEZONES).toEqual(NOTIFY_TIMEZONES.map((t) => t.tz));
  });

  it('isNotifyTimezone: пояс устройства вне списка — да; выдумка, пусто, не строка — нет', () => {
    expect(isNotifyTimezone('Europe/Paris')).toBe(true);
    expect(isNotifyTimezone('Mars/Base')).toBe(false);
    expect(isNotifyTimezone('')).toBe(false);
    expect(isNotifyTimezone(3)).toBe(false);
    expect(isNotifyTimezone('Europe/' + 'x'.repeat(80))).toBe(false);
  });
});
