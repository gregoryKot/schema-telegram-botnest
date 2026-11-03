// Выбор часового пояса (QA 2026-11-03): не было России восточнее Москвы,
// Алматы стоял с UTC+6, а пояс, определённый браузером вне списка, выбор не
// показывал вовсе.
import { describe, expect, it } from 'vitest';
import {
  NOTIFY_TIMEZONE_CITIES,
  timezoneLabel,
  timezoneOptions,
} from './timezones';
import { forEachTimeZone } from '../utils/timeZone.test-helpers';

const WINTER = new Date('2026-01-15T12:00:00Z');
const SUMMER = new Date('2026-07-15T12:00:00Z');

describe('timezoneOptions', () => {
  it('Россия до Камчатки и Алматы по UTC+5 — смещение от Intl, а не руками', () => {
    const labels = timezoneOptions(null, WINTER).map((o) => o.label);
    expect(labels).toEqual(
      expect.arrayContaining([
        'Екатеринбург (UTC+5)',
        'Новосибирск (UTC+7)',
        'Владивосток (UTC+10)',
        'Камчатка (UTC+12)',
        'Алматы (UTC+5)',
      ]),
    );
  });

  it('летнее время меняет подпись (Лондон зимой +0, летом +1) — в любой зоне машины', () => {
    forEachTimeZone(() => {
      expect(timezoneLabel('Europe/London', WINTER)).toBe('Лондон (UTC+0)');
      expect(timezoneLabel('Europe/London', SUMMER)).toBe('Лондон (UTC+1)');
    });
  });

  it('пояс браузера вне списка стоит первым и подписан по-русски', () => {
    const opts = timezoneOptions('Europe/Paris', WINTER);
    expect(opts[0]).toEqual({ iana: 'Europe/Paris', label: 'Париж (UTC+1)' });
    expect(opts).toHaveLength(NOTIFY_TIMEZONE_CITIES.length + 1);
  });

  it('пояс из списка не дублируется; выдуманный пояс в выбор не попадает', () => {
    expect(timezoneOptions('Asia/Vladivostok', WINTER)).toHaveLength(
      NOTIFY_TIMEZONE_CITIES.length,
    );
    expect(timezoneOptions('Mars/Base', WINTER)).toHaveLength(
      NOTIFY_TIMEZONE_CITIES.length,
    );
  });

  it('timezoneLabel: незнакомый IANA — хвост имени, выдумка — как есть', () => {
    expect(timezoneLabel('Asia/Kathmandu', WINTER)).toBe(
      'Kathmandu (UTC+5:45)',
    );
    expect(timezoneLabel('Mars/Base', WINTER)).toBe('Mars/Base');
  });
});
