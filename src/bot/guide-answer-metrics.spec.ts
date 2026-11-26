import {
  formatGuideAnswerLines,
  withGuideAnswerLines,
} from './guide-answer-metrics';

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

describe('withGuideAnswerLines', () => {
  const prisma = (counts: Record<string, number>) =>
    ({
      analyticsEvent: {
        // Как в Postgres: у события без строк группы нет.
        groupBy: ({ where }: { where: { name: { in: string[] } } }) =>
          Promise.resolve(
            where.name.in
              .filter((name) => name in counts)
              .map((name) => ({ name, _count: { _all: counts[name] } })),
          ),
      },
    }) as never;

  it('каждое число — своё событие; строка дописана к блоку', async () => {
    const text = await withGuideAnswerLines(
      prisma({ cabinet_guide_answer_show: 5, cabinet_guide_answer_link: 2 }),
      'блок',
    );
    expect(text).toBe(
      'блок\nГотовый ответ над поиском показан: 5, по ссылкам из него перешли: 2',
    );
  });

  it('пустая БД — блок как был', async () => {
    await expect(withGuideAnswerLines(prisma({}), 'блок')).resolves.toBe(
      'блок',
    );
  });
});
