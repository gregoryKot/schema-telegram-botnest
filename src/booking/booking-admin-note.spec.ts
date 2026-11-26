import {
  awaitingPaymentTitle,
  RETURNING_NOT_FOUND_NOTE,
} from './booking-admin-note';
import { subjectFromTitle } from './booking-notify.format';

describe('awaitingPaymentTitle', () => {
  it('без пометки — прежний заголовок, без предупреждения', () => {
    expect(awaitingPaymentTitle()).toBe(
      '⏳ <b>Бронь ожидает оплаты</b> (слот зарезервирован на 15 мин)',
    );
  });

  it('с пометкой — пометка второй строкой после ⚠️', () => {
    const [first, second] = awaitingPaymentTitle(
      RETURNING_NOT_FOUND_NOTE,
    ).split('\n');
    expect(first).toContain('Бронь ожидает оплаты');
    expect(second).toBe(`⚠️ ${RETURNING_NOT_FOUND_NOTE}`);
  });

  it('HTML в пометке экранируется (parse_mode HTML)', () => {
    expect(awaitingPaymentTitle('<b>x</b>')).toContain('&lt;b&gt;x&lt;/b&gt;');
  });

  it('тема письма начинается с «Бронь ожидает оплаты» и несёт пометку без эмодзи', () => {
    const subject = subjectFromTitle(
      awaitingPaymentTitle(RETURNING_NOT_FOUND_NOTE),
    );
    expect(subject.startsWith('Бронь ожидает оплаты')).toBe(true);
    expect(subject).toContain(RETURNING_NOT_FOUND_NOTE);
    expect(subject).not.toContain('⚠');
  });
});
