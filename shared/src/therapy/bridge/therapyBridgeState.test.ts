// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  dismissFor14Days,
  getCrisisSeenAt,
  getDismissedUntil,
  noteCrisisSeen,
} from './therapyBridgeState';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('therapyBridgeState', () => {
  it('пусто, пока ничего не записано', () => {
    expect(getDismissedUntil()).toBeNull();
    expect(getCrisisSeenAt()).toBeNull();
  });

  it('«Не сейчас» прячет ровно на 14 дней', () => {
    dismissFor14Days(new Date('2026-10-27T12:00:00.000Z'));
    expect(getDismissedUntil()).toBe('2026-11-10T12:00:00.000Z');
    expect(localStorage.getItem('therapy_nudge_dismissed_until')).toBe(
      '2026-11-10T12:00:00.000Z',
    );
  });

  it('кризисный след: записал — прочитал', () => {
    noteCrisisSeen(new Date('2026-10-27T08:30:00.000Z'));
    expect(getCrisisSeenAt()).toBe('2026-10-27T08:30:00.000Z');
    expect(localStorage.getItem('therapy_crisis_seen_at')).toBe(
      '2026-10-27T08:30:00.000Z',
    );
  });

  it('хранилище бросает — не падаем, читаем null', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => dismissFor14Days()).not.toThrow();
    expect(() => noteCrisisSeen()).not.toThrow();
    expect(getDismissedUntil()).toBeNull();
    expect(getCrisisSeenAt()).toBeNull();
  });
});
