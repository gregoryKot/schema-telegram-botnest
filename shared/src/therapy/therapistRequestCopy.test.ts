// Одна строка обещания на обе формы заявки психолога: обещание называет все
// каналы доставки решения и не обещает «появится здесь» как единственный путь.
import { describe, it, expect } from 'vitest';
import {
  THERAPIST_REQUEST_PENDING,
  therapistRequestApprovedText,
} from './therapistRequestCopy';

const ty = (t: string) => t;
const vy = (_t: string, v: string) => v;

describe('THERAPIST_REQUEST_PENDING', () => {
  it('называет каналы доставки по порядку: Telegram, почта, контакты из заявки', () => {
    const tg = THERAPIST_REQUEST_PENDING.indexOf('Telegram');
    const mail = THERAPIST_REQUEST_PENDING.indexOf('на почту');
    const contacts = THERAPIST_REQUEST_PENDING.indexOf(
      'по контактам из заявки',
    );
    expect(tg).toBeGreaterThan(-1);
    expect(mail).toBeGreaterThan(tg);
    expect(contacts).toBeGreaterThan(mail);
  });

  it('не обещает решение «здесь» вместо сообщения и звучит одинаково при любой форме', () => {
    expect(THERAPIST_REQUEST_PENDING).not.toMatch(/появится здесь/);
    expect(THERAPIST_REQUEST_PENDING).not.toMatch(
      /(^|[^а-яё])(ты|вы|твоя|ваша)([^а-яё]|$)/iu,
    );
    expect('Ваша заявка').toMatch(/(^|[^а-яё])(ты|вы|твоя|ваша)([^а-яё]|$)/iu); // контрольный образец
  });
});

describe('therapistRequestApprovedText', () => {
  it('«ты» и «вы» — разные формы одного текста', () => {
    expect(therapistRequestApprovedText(ty)).toBe(
      'Заявка одобрена. Перезайди в приложение, чтобы появился кабинет терапевта.',
    );
    expect(therapistRequestApprovedText(vy)).toBe(
      'Заявка одобрена. Перезайдите в приложение, чтобы появился кабинет терапевта.',
    );
  });
});
