// Точечное покрытие notification.templates.soft.ts, case 'value_recap' (было
// 76%/67% — непокрытые строки 82-101): день 14 без записей, зеркало
// собственных данных (сильная/слабая потребность). renderTemplate неизвестные
// типы делегирует в renderSoftTemplate — используем оба входа.
import { renderSoftTemplate, pluralDays } from './notification.templates.soft';
import { renderTemplate } from './notification.templates';

describe('renderSoftTemplate — value_recap', () => {
  it('без обязательных полей (strongest/weakest/avg) — null, а не битый рендер', () => {
    expect(renderSoftTemplate('value_recap', {})).toBeNull();
    expect(
      renderSoftTemplate('value_recap', { strongest: 'Привязанность' }),
    ).toBeNull();
    expect(
      renderSoftTemplate('value_recap', {
        strongest: 'Привязанность',
        weakest: 'Автономия',
        strongestAvg: 8,
        // weakestAvg отсутствует
      }),
    ).toBeNull();
  });

  it('полный payload — рендерит сильную/слабую потребность со средними, форма "ты"', () => {
    const result = renderSoftTemplate(
      'value_recap',
      {
        totalDays: 14,
        strongest: 'Привязанность',
        strongestAvg: 8.333,
        weakest: 'Автономия',
        weakestAvg: 3.667,
      },
      'ty',
    );
    expect(result).not.toBeNull();
    expect(result!.text).toContain('привязанность — твоя опора');
    expect(result!.text).toContain('8.3');
    expect(result!.text).toContain('автономия чаще проседала');
    expect(result!.text).toContain('3.7');
    expect(result!.text).toContain('За 14 дней наблюдений');
    expect(result!.text).toContain('Это твои данные');
    expect(result!.keyboard).toBeDefined();
  });

  it('форма "вы" — местоимения меняются, содержимое то же', () => {
    const result = renderSoftTemplate(
      'value_recap',
      {
        totalDays: 14,
        strongest: 'Привязанность',
        strongestAvg: 8,
        weakest: 'Автономия',
        weakestAvg: 3,
      },
      'vy',
    );
    expect(result!.text).toContain('ваша опора');
    expect(result!.text).toContain('Это ваши данные');
    expect(result!.text).not.toContain('твоя опора');
  });

  it('без totalDays — заголовок "За это время", не падает', () => {
    const result = renderSoftTemplate('value_recap', {
      strongest: 'Привязанность',
      strongestAvg: 8,
      weakest: 'Автономия',
      weakestAvg: 3,
    });
    expect(result!.text).toContain('За это время у тебя сложилась картина');
  });

  it('доступен и через renderTemplate (диспетчер неизвестных типов → soft)', () => {
    const result = renderTemplate('value_recap', {
      strongest: 'Привязанность',
      strongestAvg: 8,
      weakest: 'Автономия',
      weakestAvg: 3,
    });
    expect(result).not.toBeNull();
  });
});

describe('pluralDays', () => {
  it.each([
    [1, 'день'],
    [21, 'день'],
    [2, 'дня'],
    [3, 'дня'],
    [4, 'дня'],
    [22, 'дня'],
    [5, 'дней'],
    [11, 'дней'],
    [12, 'дней'],
    [14, 'дней'],
    [0, 'дней'],
  ])('pluralDays(%i) === %s', (n, expected) => {
    expect(pluralDays(n)).toBe(expected);
  });
});
