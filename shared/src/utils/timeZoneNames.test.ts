import { describe, it, expect } from 'vitest';
import {
  RUSSIAN_TZ_NAMES,
  TIME_ZONE_OPTIONS,
  isValidTimeZone,
  cityLabel,
} from './timeZoneNames';

describe('isValidTimeZone', () => {
  it('признаёт настоящие IANA-пояса', () => {
    expect(isValidTimeZone('Asia/Bangkok')).toBe(true);
    expect(isValidTimeZone('Europe/Moscow')).toBe(true);
  });

  it('отвергает мусор и пустую строку', () => {
    expect(isValidTimeZone('not-a-timezone')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
  });
});

describe('cityLabel', () => {
  it('известный пояс — русское название из словаря', () => {
    expect(cityLabel('Asia/Bangkok')).toBe('Бангкок');
    expect(cityLabel('Europe/Moscow')).toBe('Москва');
  });

  it('незнакомый, но валидный IANA-пояс — последний сегмент без подчёркиваний', () => {
    expect(cityLabel('Pacific/Auckland')).toBe('Auckland');
    expect(cityLabel('America/Argentina/Buenos_Aires')).toBe('Buenos Aires');
  });
});

describe('TIME_ZONE_OPTIONS', () => {
  it('каждая запись — валидный пояс с непустым русским названием', () => {
    expect(TIME_ZONE_OPTIONS.length).toBeGreaterThan(30);
    for (const { tz, label } of TIME_ZONE_OPTIONS) {
      expect(isValidTimeZone(tz)).toBe(true);
      expect(label.length).toBeGreaterThan(0);
    }
  });

  it('совпадает по составу со словарём', () => {
    expect(TIME_ZONE_OPTIONS.length).toBe(Object.keys(RUSSIAN_TZ_NAMES).length);
  });
});
