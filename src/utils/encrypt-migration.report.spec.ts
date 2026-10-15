import { describeClinicalProblems } from './encrypt-migration.report';

describe('describeClinicalProblems (текст итога миграции для владельца)', () => {
  it('чистая БД и чистый прогон — пустой остаток, ни «0», ни «NaN», ни «undefined»', () => {
    expect(describeClinicalProblems({ unknownKey: {}, failures: 0 })).toEqual(
      [],
    );
  });

  it.each([1, 2, 5, 21])(
    'число %s стоит после двоеточия: слово «строк» с ним не согласуется',
    (n) => {
      const [lost] = describeClinicalProblems({
        unknownKey: { Note: n },
        failures: 0,
      });
      expect(lost).toBe(
        `строк под нечитаемым ключом: ${n} (Note: ${n}) — старый ключ ` +
          'шифрования убран раньше, чем дошифровались строки',
      );
      const [failed] = describeClinicalProblems({
        unknownKey: {},
        failures: n,
      });
      expect(failed).toBe(`не удалось записать строк: ${n}`);
    },
  );

  it('несколько таблиц: общий итог и разбивка по таблицам', () => {
    const [lost] = describeClinicalProblems({
      unknownKey: { Note: 2, ModeDiaryEntry: 1 },
      failures: 0,
    });
    expect(lost).toContain(
      'строк под нечитаемым ключом: 3 (Note: 2, ModeDiaryEntry: 1)',
    );
  });

  it('обе причины — два пункта, ключ первым', () => {
    const parts = describeClinicalProblems({
      unknownKey: { User: 1 },
      failures: 4,
    });
    expect(parts).toHaveLength(2);
    expect(parts[0]).toContain('строк под нечитаемым ключом: 1 (User: 1)');
    expect(parts[1]).toBe('не удалось записать строк: 4');
  });

  it('жаргона нет: ни имени переменной, ни слова «ротация»', () => {
    const text = describeClinicalProblems({
      unknownKey: { Note: 1 },
      failures: 1,
    }).join(' ');
    expect(text).not.toMatch(/ENCRYPTION_KEY|ротаци/i);
  });
});
