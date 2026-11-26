import { describe, it, expect } from 'vitest';
import { TicketHttpError, linkFailOutcome } from './linkFailModel';

describe('linkFailOutcome — исход /link, когда сводка не загрузилась', () => {
  it.each([400, 404, 410, 429])('%i — код не найден, устарел или лимит: wait', (status) => {
    expect(linkFailOutcome(new TicketHttpError('x', status))).toBe('wait');
  });

  it.each([500, 502, 503])('%i — сбой на нашей стороне', (status) => {
    expect(linkFailOutcome(new TicketHttpError('x', status))).toBe('our_side');
  });

  it('обрыв сети и прочие ошибки — сбой на нашей стороне', () => {
    expect(linkFailOutcome(new TypeError('Failed to fetch'))).toBe('our_side');
    expect(linkFailOutcome('что-то')).toBe('our_side');
  });

  it('текст ошибки остаётся прежним', () => {
    expect(new TicketHttpError('Код не найден', 404).message).toBe('Код не найден');
  });
});
