// notification.templates.soft.ts, case 'value_recap': день 14 без записей.
// В тексте только число дней — оценок, средних и потребностей нет (РКН, #1135).
import { renderSoftTemplate, pluralDays } from './notification.templates.soft';
import { renderTemplate } from './notification.templates';

describe('renderSoftTemplate — value_recap', () => {
  it('только totalDays, форма "ты"; кнопка в приложение', () => {
    const result = renderSoftTemplate('value_recap', { totalDays: 14 }, 'ty');
    expect(result!.text).toContain('За 14 дней наблюдений у тебя');
    expect(result!.text).toContain('Это твои данные');
    expect(result!.keyboard).toBeDefined();
  });

  it('форма "вы" — местоимения меняются', () => {
    const result = renderSoftTemplate('value_recap', { totalDays: 14 }, 'vy');
    expect(result!.text).toContain('у вас');
    expect(result!.text).toContain('Это ваши данные');
    expect(result!.text).not.toContain('твои');
  });

  it('без totalDays — «За это время», не падает; старый payload с оценками не читается', () => {
    const result = renderTemplate('value_recap', {
      strongest: 'Привязанность',
      strongestAvg: 8.3,
      weakest: 'Автономия',
      weakestAvg: 3.7,
    });
    expect(result!.text).toContain('За это время у тебя сложилась картина');
    expect(result!.text).not.toMatch(
      /Привязанность|привязанность|Автономия|8\.3|3\.7/,
    );
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
