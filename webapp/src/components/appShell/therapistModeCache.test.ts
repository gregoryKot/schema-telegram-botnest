// @vitest-environment jsdom
// Кэш стартового режима: запись '1'/'0' и чтение с null для «не выбирали».
import { describe, it, expect, beforeEach } from 'vitest';
import { cacheTherapistMode, readTherapistMode } from './therapistModeCache';
import { THERAPIST_MODE_KEY } from '../../utils/storageKeys';

beforeEach(() => localStorage.clear());

describe('therapistModeCache', () => {
  it('true пишет 1 и читается как true', () => {
    cacheTherapistMode(true);
    expect(localStorage.getItem(THERAPIST_MODE_KEY)).toBe('1');
    expect(readTherapistMode()).toBe(true);
  });

  it('false пишет 0 и читается как false', () => {
    cacheTherapistMode(false);
    expect(localStorage.getItem(THERAPIST_MODE_KEY)).toBe('0');
    expect(readTherapistMode()).toBe(false);
  });

  it('без записи — null', () => {
    expect(readTherapistMode()).toBeNull();
  });
});
