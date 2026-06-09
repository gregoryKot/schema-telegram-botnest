import { describe, it, expect } from 'vitest';
import { shouldShowChildhoodWheel, CHILDHOOD_DONE_KEY } from './storageKeys';

describe('shouldShowChildhoodWheel', () => {
  it('true, когда колесо ещё не пройдено', () => {
    expect(shouldShowChildhoodWheel()).toBe(true);
  });

  it('false после отметки о прохождении', () => {
    localStorage.setItem(CHILDHOOD_DONE_KEY, '1');
    expect(shouldShowChildhoodWheel()).toBe(false);
  });
});
