import { describe, it, expect } from 'vitest';
import { tasksLinkSub } from './tasksLink';

describe('tasksLinkSub', () => {
  it.each([
    [2, 1, '2 от терапевта · 1 цель'],
    [1, 3, '1 от терапевта · 3 цели'],
    [1, 5, '1 от терапевта · 5 целей'],
    [3, 0, '3 от терапевта'],
    [0, 1, '1 активная цель'],
    [0, 3, '3 активные цели'],
    [0, 11, '11 активных целей'],
    [0, 0, 'Свои цели и шаги к ним'],
  ])('%i от терапевта, %i целей → «%s»', (t, g, text) => {
    expect(tasksLinkSub(t, g)).toBe(text);
  });
});
