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
  it('id брони, клиент, контакт, слот, сумма и что делать: вернуть деньги или записать заново', () => {
    const { html } = paidAfterCancelAlert(b, 3000);
    expect(html).toContain('#77');
    expect(html).toContain('@maria');
    expect(html).toContain('3000 ₽');
    expect(html).toContain('Верните деньги');
    expect(html).toContain('запишите его заново');
    expect(html).toMatch(/МСК/); // слот
  });

  it('имя клиента экранируется (parse_mode HTML)', () => {
    expect(paidAfterCancelAlert(b, 3000).html).toContain('Мария &lt;b&gt;');
  });

  it('тема письма без HTML и эмодзи', () => {
    expect(paidAfterCancelAlert(b, 3000).subject).toBe(
      'Деньги получены, а брони #77 нет',
    );
  });

  it('без суммы не пишет NaN/undefined', () => {
    const { html } = paidAfterCancelAlert(b);
    expect(html).toContain('сумма не указана');
    expect(html).not.toMatch(/undefined|NaN/);
  });
});
