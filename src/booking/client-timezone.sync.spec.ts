// Сверка бэкендовой копии словаря/офсет-логики со shared/src (правило №4
// CLAUDE.md — два места, обязанные совпадать, фиксируются тестом-сверкой;
// см. комментарий в client-timezone.ts про то, почему это копия, а не импорт).
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  RUSSIAN_TZ_NAMES as BACKEND_NAMES,
  cityLabel as backendCityLabel,
} from './client-timezone-names';
import {
  offsetMinutes,
  offsetLabel,
  isMoscowOffset,
  isMoscowTimeZone,
} from './client-timezone';

const SHARED_NAMES_PATH = join(
  __dirname,
  '..',
  '..',
  'shared',
  'src',
  'utils',
  'timeZoneNames.ts',
);
const SHARED_TZ_PATH = join(
  __dirname,
  '..',
  '..',
  'shared',
  'src',
  'booking',
  'clientTimeZone.ts',
);

/** Достаёт литерал RUSSIAN_TZ_NAMES из shared-исходника без компиляции TS. */
function parseSharedNames(): Record<string, string> {
  const src = readFileSync(SHARED_NAMES_PATH, 'utf8');
  const body = src.match(/RUSSIAN_TZ_NAMES[\s\S]*?=\s*\{([\s\S]*?)\n\};/);
  if (!body)
    throw new Error(
      'Не нашёл RUSSIAN_TZ_NAMES в shared/src/utils/timeZoneNames.ts',
    );
  const out: Record<string, string> = {};
  for (const m of body[1].matchAll(/'([^']+)':\s*'([^']+)'/g)) out[m[1]] = m[2];
  return out;
}

/** Достаёт литерал MOSCOW_TIME_ZONES из shared-исходника без компиляции TS. */
function parseSharedMoscowZones(): string[] {
  const src = readFileSync(SHARED_TZ_PATH, 'utf8');
  const body = src.match(/MOSCOW_TIME_ZONES[\s\S]*?=\s*\[([\s\S]*?)\];/);
  if (!body)
    throw new Error(
      'Не нашёл MOSCOW_TIME_ZONES в shared/src/booking/clientTimeZone.ts',
    );
  return [...body[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

describe('client-timezone ↔ shared/src/booking/clientTimeZone', () => {
  it('словарь городов совпадает', () => {
    expect(BACKEND_NAMES).toEqual(parseSharedNames());
  });

  it('shared-модуль реально существует (файл не переехал/не переименован)', () => {
    expect(() => readFileSync(SHARED_TZ_PATH, 'utf8')).not.toThrow();
  });

  it('cityLabel для контрольных поясов совпадает по смыслу со shared', () => {
    expect(backendCityLabel('Asia/Bangkok')).toBe('Бангкок');
    expect(backendCityLabel('Europe/Moscow')).toBe('Москва');
  });

  it('офсет-логика даёт те же контрольные значения, что shared-тест clientTimeZone.test.ts', () => {
    const at = new Date('2026-09-28T00:00:00Z');
    expect(offsetMinutes('Asia/Bangkok', at)).toBe(7 * 60);
    expect(offsetLabel('Asia/Kolkata', at)).toBe('UTC+5:30');
    expect(isMoscowOffset('Europe/Istanbul', at)).toBe(true);
    expect(isMoscowOffset('Asia/Bangkok', at)).toBe(false);
  });

  it('список MOSCOW_TIME_ZONES совпадает со shared/src/booking/clientTimeZone.ts', () => {
    expect(parseSharedMoscowZones()).toEqual([
      'Europe/Moscow',
      'Europe/Simferopol',
      'Europe/Kirov',
      'Europe/Volgograd',
    ]);
  });

  it('isMoscowTimeZone — Москва и синонимы да, совпадающий офсет чужого пояса нет', () => {
    expect(isMoscowTimeZone('Europe/Moscow')).toBe(true);
    expect(isMoscowTimeZone('Europe/Simferopol')).toBe(true);
    expect(isMoscowTimeZone('Europe/Istanbul')).toBe(false);
    expect(isMoscowTimeZone('Asia/Jerusalem')).toBe(false);
  });
});
