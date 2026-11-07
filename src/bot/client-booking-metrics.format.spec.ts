import { formatClientBookingMetrics } from './client-booking-metrics.format';

const EMPTY = { opened: 0, openedPeople: 0, held: 0, confirmed: 0 };

describe('formatClientBookingMetrics — блок /stats «Запись из приложения»', () => {
  it('пустая БД — заголовок и человеческая строка, без нулей и NaN', () => {
    const text = formatClientBookingMetrics(EMPTY);
    expect(text).toContain('Запись из приложения');
    expect(text).toContain('Пока никто не записывался сам.');
    expect(text).not.toMatch(/\b0\b|NaN|undefined/);
  });

  it('открыли и записались — оба числа и разбивка по оплате', () => {
    const text = formatClientBookingMetrics({
      opened: 7,
      openedPeople: 3,
      held: 2,
      confirmed: 1,
    });
    expect(text).toContain('Открыли запись: 7 раз, людей — 3.');
    expect(text).toContain(
      'Записались: 3 (ждали оплаты 2, подтверждены сразу 1).',
    );
  });

  it('только открывали — строки про записи нет', () => {
    const text = formatClientBookingMetrics({
      ...EMPTY,
      opened: 2,
      openedPeople: 2,
    });
    expect(text).toContain('Открыли запись: 2 раз');
    expect(text).not.toContain('Записались');
  });

  it('нулевая часть разбивки не печатается', () => {
    const text = formatClientBookingMetrics({ ...EMPTY, confirmed: 4 });
    expect(text).toContain('Записались: 4 (подтверждены сразу 4).');
    expect(text).not.toContain('ждали оплаты');
  });
});
