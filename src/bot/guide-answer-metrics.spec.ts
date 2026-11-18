import { formatGuideAnswerLines } from './guide-answer-metrics';

describe('formatGuideAnswerLines', () => {
  it('пустая БД — строки нет', () => {
    expect(formatGuideAnswerLines({ answers30: 0, answerLinks30: 0 })).toEqual(
      [],
    );
  });

  it('карточку показывали, переходов нет — без нуля', () => {
    expect(formatGuideAnswerLines({ answers30: 4, answerLinks30: 0 })).toEqual([
      'Готовый ответ над поиском показан: 4',
    ]);
  });

  it('с переходами — оба числа одной строкой', () => {
    expect(formatGuideAnswerLines({ answers30: 4, answerLinks30: 2 })).toEqual([
      'Готовый ответ над поиском показан: 4, по ссылкам из него перешли: 2',
    ]);
  });
});
