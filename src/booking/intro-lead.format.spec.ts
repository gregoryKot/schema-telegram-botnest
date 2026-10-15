// Тексты уведомлений о заявке с формы знакомства и нормализация входа.
// Переехали из booking.controller.spec.ts вместе с кодом: экранирование полей,
// строка «Откуда», подпись канала, молчаливый дроп неполных заявок (не оракул).
import { introLeadMessages, normalizeIntroLead } from './intro-lead.format';

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

  it('обрезает по длине и trim: имя и контакт 100, запрос 500, откуда 200', () => {
    const n = normalizeIntroLead({
      name: ` ${'и'.repeat(150)}`,
      contact: `${'к'.repeat(150)} `,
      message: ' ' + 'з'.repeat(900),
      source: 'с'.repeat(300),
    });
    // Срез по 100 символов идёт до trim: ведущий пробел съедает одну букву.
    expect(n?.name).toBe('и'.repeat(99));
    expect(n?.contact).toHaveLength(100);
    expect(n?.message).toHaveLength(499); // тот же порядок: срез 500, потом trim
    expect(n?.source).toHaveLength(200);
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
  it('HTML в полях экранирован в DM, в письме — как есть', () => {
    const m = introLeadMessages(
      lead({ name: 'Мария <b>', contact: '@maria', message: 'Привет & пока' }),
    );
    expect(m.tg).toContain('Мария &lt;b&gt;');
    expect(m.tg).toContain('Привет &amp; пока');
    expect(m.tg).not.toContain('<b>Мария');
    expect(m.email).toContain('Имя: Мария <b>');
  });

  it('source идёт строкой «Откуда», экранированный', () => {
    const m = introLeadMessages(lead({ source: '<i>x</i>' }));
    expect(m.tg).toContain('<b>Откуда:</b> &lt;i&gt;x&lt;/i&gt;');
    expect(m.email).toContain('Откуда: <i>x</i>');
  });

  it('без source и без запроса таких строк нет', () => {
    const m = introLeadMessages(lead());
    expect(m.tg).not.toContain('Откуда');
    expect(m.tg).not.toContain('Запрос');
    expect(m.email).not.toContain('Откуда');
  });

  it('канал whatsapp: подпись «WhatsApp:» в DM и письме, «Контакт:» нет', () => {
    const m = introLeadMessages(
      lead({ contact: '+79990001122', channel: 'whatsapp' }),
    );
    expect(m.tg).toContain('<b>WhatsApp:</b> +79990001122');
    expect(m.email).toContain('WhatsApp: +79990001122');
    expect(m.tg).not.toContain('Контакт:');
  });

  it('без канала и с неизвестным каналом — «Контакт:»', () => {
    for (const channel of [null, 'sms']) {
      const m = introLeadMessages(lead({ contact: '+7999', channel }));
      expect(m.tg).toContain('<b>Контакт:</b> +7999');
      expect(m.email).toContain('Контакт: +7999');
    }
  });

  it('обычная заявка: заголовок без пометок, тема без хвоста', () => {
    const m = introLeadMessages(lead());
    expect(m.subject).toBe('📩 Новая заявка с сайта');
    expect(m.tg).not.toMatch(/Не сохранилась|Повторная/);
  });

  it('«не сохранилась в базе»: пометка в DM, письме и теме — админ видит, что строки нет', () => {
    const m = introLeadMessages(lead(), 'unsaved');
    expect(m.tg).toContain('Не сохранилась в базе');
    expect(m.email).toContain('Не сохранилась в базе');
    expect(m.subject).toContain('не сохранилась в базе');
    expect(m.tg).toContain('<b>Имя:</b> Имя');
  });

  it('повтор: пометка «Повторная отправка» в DM, письме и теме', () => {
    const m = introLeadMessages(lead(), 'repeat');
    expect(m.tg).toContain('Повторная отправка');
    expect(m.email).toContain('Повторная отправка');
    expect(m.subject).toContain('(повтор)');
  });
});
