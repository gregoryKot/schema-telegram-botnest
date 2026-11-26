// Тексты уведомлений о заявке с формы знакомства и нормализация входа.
// Переехали из booking.controller.spec.ts вместе с кодом: экранирование полей,
// строка «Откуда», подпись канала, молчаливый дроп неполных заявок (не оракул).
import { introLeadMessages, normalizeIntroLead } from './intro-lead.format';
import { PII, expectNoMarkers } from '../test-support/pii-markers';

const lead = (over: Partial<Parameters<typeof introLeadMessages>[0]> = {}) => ({
  name: 'Имя',
  contact: '@c',
  channel: null,
  message: null,
  source: null,
  ...over,
});

describe('normalizeIntroLead', () => {
  it('без имени или контакта — null (молчаливый дроп)', () => {
    expect(normalizeIntroLead({ name: ' ', contact: '@c' })).toBeNull();
    expect(normalizeIntroLead({ name: 'Имя', contact: '' })).toBeNull();
    expect(normalizeIntroLead({})).toBeNull();
  });

  it('не обрезает длину (предел — в DTO, 400), только trim', () => {
    const n = normalizeIntroLead({
      name: ` ${'и'.repeat(150)}`,
      contact: `${'к'.repeat(150)} `,
      message: ' ' + 'з'.repeat(900),
      source: 'с'.repeat(300),
    });
    expect(n?.name).toBe('и'.repeat(150));
    expect(n?.contact).toBe('к'.repeat(150));
    expect(n?.message).toBe('з'.repeat(900));
    expect(n?.source).toBe('с'.repeat(300));
  });

  it('пустые необязательные поля становятся null, канал сохраняется', () => {
    expect(
      normalizeIntroLead({
        name: 'Имя',
        contact: '+7',
        channel: 'whatsapp',
        message: '  ',
        source: '',
      }),
    ).toEqual({
      name: 'Имя',
      contact: '+7',
      channel: 'whatsapp',
      message: null,
      source: null,
    });
  });
});

describe('introLeadMessages', () => {
  const marked = lead({
    name: PII.name,
    contact: PII.contact,
    channel: 'telegram',
    message: PII.message,
    source: PII.source,
  });

  it('DM — номер заявки и где данные, ни одного значения человека', () => {
    for (const mark of ['saved', 'unsaved', 'repeat'] as const) {
      const m = introLeadMessages(marked, 12, mark);
      expectNoMarkers(m.tg);
      expect(m.tg).toContain('Имя, контакт и запрос — в письме на почте');
    }
    expect(introLeadMessages(marked, 12).tg).toContain(
      '<b>Новая заявка с сайта #12</b>',
    );
  });

  it('без строки в базе номера нет: «#null» не пишется', () => {
    const m = introLeadMessages(marked, null, 'unsaved');
    expect(m.tg).toContain('<b>Новая заявка с сайта</b>');
    expect(m.tg).not.toContain('#');
  });

  it('письмо — имя, контакт, запрос и источник как есть', () => {
    const m = introLeadMessages(marked, 12);
    for (const v of [PII.name, PII.contact, PII.message, PII.source]) {
      expect(m.email).toContain(v);
    }
  });

  it('в письме поля как есть (plain), source — строкой «Откуда»', () => {
    const m = introLeadMessages(
      lead({ name: 'Мария <b>', source: '<i>x</i>' }),
      1,
    );
    expect(m.email).toContain('Имя: Мария <b>');
    expect(m.email).toContain('Откуда: <i>x</i>');
  });

  it('без source и без запроса таких строк в письме нет', () => {
    const m = introLeadMessages(lead(), 1);
    expect(m.email).not.toContain('Откуда');
    expect(m.email).not.toContain('Запрос');
  });

  it('канал whatsapp: подпись «WhatsApp:» в письме, «Контакт:» нет', () => {
    const m = introLeadMessages(
      lead({ contact: '+79990001122', channel: 'whatsapp' }),
      1,
    );
    expect(m.email).toContain('WhatsApp: +79990001122');
    expect(m.email).not.toContain('Контакт:');
  });

  it('без канала и с неизвестным каналом — «Контакт:»', () => {
    for (const channel of [null, 'sms']) {
      const m = introLeadMessages(lead({ contact: '+7999', channel }), 1);
      expect(m.email).toContain('Контакт: +7999');
    }
  });

  it('обычная заявка: заголовок без пометок, тема без хвоста', () => {
    const m = introLeadMessages(lead(), 1);
    expect(m.subject).toBe('📩 Новая заявка с сайта');
    expect(m.tg).not.toMatch(/Не сохранилась|Повторная/);
  });

  it('«не сохранилась в базе»: пометка в DM, письме и теме — админ видит, что строки нет', () => {
    const m = introLeadMessages(lead(), null, 'unsaved');
    expect(m.tg).toContain('Не сохранилась в базе');
    expect(m.email).toContain('Не сохранилась в базе');
    expect(m.subject).toContain('не сохранилась в базе');
    expect(m.email).toContain('Имя: Имя');
  });

  it('повтор: пометка «Повторная отправка» в DM, письме и теме', () => {
    const m = introLeadMessages(lead(), 1, 'repeat');
    expect(m.tg).toContain('Повторная отправка');
    expect(m.email).toContain('Повторная отправка');
    expect(m.subject).toContain('(повтор)');
  });
});
