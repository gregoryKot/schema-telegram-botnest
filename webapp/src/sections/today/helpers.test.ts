import { describe, it, expect } from 'vitest';
import { homeGreeting, taskStatusMark } from './helpers';
import { formatGreetingDate } from './greetingDate';

describe('homeGreeting', () => {
  it('с именем — «Привет, имя», без имени — просто «Привет»', () => {
    expect(homeGreeting('Анна')).toBe('Привет, Анна');
    expect(homeGreeting('')).toBe('Привет');
  });
});

describe('taskStatusMark', () => {
  it('сделано ✓, не сделано ×, в работе ·', () => {
    expect(taskStatusMark(true)).toBe('✓');
    expect(taskStatusMark(false)).toBe('×');
    expect(taskStatusMark(null)).toBe('·');
  });
});

describe('formatGreetingDate', () => {
  it('день недели и дата по-русски: «воскресенье, 18 октября»', () => {
    expect(formatGreetingDate(new Date(2026, 9, 18, 12))).toBe('воскресенье, 18 октября');
  });
});
