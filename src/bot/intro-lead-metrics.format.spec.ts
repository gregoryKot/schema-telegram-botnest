// Блок «Заявки с формы знакомства» в /stats (правило №8): простой язык,
// пустое состояние без «0/NaN/undefined».
import { formatIntroLeads } from './intro-lead-metrics.format';

describe('formatIntroLeads', () => {
  it('пустая база: «заявок не было», ни одной цифры-нуля и мусора', () => {
    const text = formatIntroLeads({ week: 0, weekLost: 0, olderLost: 0 });
    expect(text).toBe(
      '📩 <b>Заявки с формы знакомства</b>\nЗа неделю заявок не было.',
    );
    expect(text).not.toMatch(/NaN|undefined|\b0\b/);
  });

  it('все дошли: одна спокойная строка', () => {
    const text = formatIntroLeads({ week: 4, weekLost: 0, olderLost: 0 });
    expect(text).toContain('За неделю заявок: 4, все дошли.');
    expect(text).not.toContain('⚠️');
  });

  it('часть не дошла: число и что делать, простыми словами', () => {
    const text = formatIntroLeads({ week: 5, weekLost: 2, olderLost: 0 });
    expect(text).toContain(
      'За неделю заявок: 5, не дошли ни в бот, ни на почту: 2.',
    );
    expect(text).toContain('Нужно проверить бота и почту');
    expect(text).toContain('⚠️');
  });

  it('старые недошедшие: число одной строкой, без склонения', () => {
    for (const n of [1, 2, 5, 11, 21]) {
      const text = formatIntroLeads({ week: 0, weekLost: 0, olderLost: n });
      expect(text).toContain(`Недоставленных заявок старше недели: ${n}.`);
    }
  });

  it('без старых недошедших строки про них нет', () => {
    expect(
      formatIntroLeads({ week: 3, weekLost: 1, olderLost: 0 }),
    ).not.toContain('старше недели');
  });
});
