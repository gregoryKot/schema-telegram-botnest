import { SessionType } from '@prisma/client';
import { paidAfterCancelAlert } from './booking-paid-after-cancel';

const b = {
  id: 77,
  startsAt: new Date('2026-07-13T17:00:00Z'),
  durationMin: 50,
  type: SessionType.SESSION_50,
  clientName: 'Мария <b>',
  clientContact: '@maria',
  message: null,
  meetingUrl: null,
  cancelToken: 'tok',
};

describe('paidAfterCancelAlert — сигнал «деньги получены, а брони нет»', () => {
  it('оба канала: id брони, слот, сумма и что делать — вернуть деньги или записать заново', () => {
    const { html } = paidAfterCancelAlert(b, 3000);
    for (const text of [html.telegram, html.email]) {
      expect(text).toContain('#77');
      expect(text).toContain('3000 ₽');
      expect(text).toContain('Верните деньги');
      expect(text).toContain('запишите его заново');
      expect(text).toMatch(/МСК/); // слот
    }
  });

  it('имя и контакт — только в письме, имя экранировано', () => {
    const { html } = paidAfterCancelAlert(b, 3000);
    expect(html.email).toContain('@maria');
    expect(html.email).toContain('Мария &lt;b&gt;');
    expect(html.telegram).not.toContain('@maria');
    expect(html.telegram).not.toContain('Мария');
  });

  it('тема письма без HTML и эмодзи', () => {
    expect(paidAfterCancelAlert(b, 3000).subject).toBe(
      'Деньги получены, а брони #77 нет',
    );
  });

  it('без суммы не пишет NaN/undefined', () => {
    const { html } = paidAfterCancelAlert(b);
    expect(html.telegram).toContain('сумма не указана');
    expect(`${html.telegram}${html.email}`).not.toMatch(/undefined|NaN/);
  });
});
