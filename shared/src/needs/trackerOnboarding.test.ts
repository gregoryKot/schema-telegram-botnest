import { describe, it, expect } from 'vitest';
import { TRACKER_ORIGIN_NOTE } from './trackerOnboarding';

describe('trackerOnboarding', () => {
  it('строка над трекером говорит, откуда потребности и зачем их отмечать', () => {
    expect(TRACKER_ORIGIN_NOTE).toMatch(/схема-терапии/);
    expect(TRACKER_ORIGIN_NOTE).toMatch(/станет видно/);
  });
});
