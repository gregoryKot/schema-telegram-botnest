import { describe, it, expect } from 'vitest';
import { FAQ_ITEMS } from './constants';
import { faqAnswer, FAQ_PRICE_ABROAD } from './faqAnswer';

const priceItem = FAQ_ITEMS.find((i) => i.a.includes('{PRICE}'))!;

describe('faqAnswer — ответ про цену по способу оплаты', () => {
  it('в FAQ ровно один ответ с {PRICE}, и в нём нет захардкоженного знака валюты', () => {
    expect(FAQ_ITEMS.filter((i) => i.a.includes('{PRICE}'))).toHaveLength(1);
    expect(priceItem.a).not.toMatch(/\{PRICE\} ₽/);
  });

  it('рубли: ответ про СБП и чек самозанятого, цена подставлена вместе со знаком', () => {
    const text = faqAnswer(priceItem.a, '4 000 ₽', true);
    expect(text).toContain('(50 минут) – 4 000 ₽.');
    expect(text).toContain('Оплата картой или СБП при записи');
    expect(text).toContain('Мой налог');
    expect(text).not.toContain('{PRICE}');
  });

  it('не рубли: «об оплате договоримся после записи», без СБП и чека', () => {
    const text = faqAnswer(priceItem.a, '70 $', false);
    expect(text).toContain('(50 минут) – 70 $.');
    expect(text).toContain('Об оплате договоримся после записи: напишу, какие способы вам доступны.');
    expect(text).not.toMatch(/СБП|Мой налог|Robokassa/);
    expect(FAQ_PRICE_ABROAD).toContain('{PRICE}');
  });

  it('ответ без {PRICE} не трогается ни в рублях, ни вне них', () => {
    const other = FAQ_ITEMS.find((i) => !i.a.includes('{PRICE}'))!;
    expect(faqAnswer(other.a, '70 $', false)).toBe(other.a);
    expect(faqAnswer(other.a, '70 $', true)).toBe(other.a);
  });
});
