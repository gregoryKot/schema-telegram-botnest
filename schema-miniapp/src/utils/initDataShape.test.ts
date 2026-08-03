// @vitest-environment jsdom
// Форма строки запуска — то, что показывается на экране ошибки входа вместо
// бесполезного «не удалось войти». Главное требование: НИ ОДНОГО значения,
// потому что текст уходит в скриншоты, а в строке лежат id и имя человека.
import { describe, it, expect } from 'vitest';
import { describeInitDataShape, formatInitDataShape } from './initDataShape';

describe('describeInitDataShape', () => {
  it('перечисляет поля по алфавиту и не отдаёт значений', () => {
    const initData =
      'user=%7B%22id%22%3A42%2C%22first_name%22%3A%22%D0%98%D1%80%D0%B0%22%7D' +
      '&auth_date=1700000000&hash=abc';
    const shape = describeInitDataShape(initData)!;

    expect(shape.keys).toBe('auth_date,hash,user');
    const line = formatInitDataShape(shape);
    expect(line).not.toContain('42');
    expect(line).not.toContain('Ира');
    expect(line).not.toContain('%');
    expect(line).not.toContain('{');
  });

  it('видит лишний слой кодирования — главная гипотеза о причине', () => {
    // Значение закодировано дважды: после одного decodeURIComponent проценты
    // остаются, и бэкенд получает не то, что подписывала площадка.
    const twice = 'user=%257B%2522id%2522%253A42%257D&hash=abc';
    expect(describeInitDataShape(twice)!.stillEncoded).toBe(true);
    expect(formatInitDataShape(describeInitDataShape(twice)!)).toContain(
      'кодировка внутри: осталась',
    );
  });

  it('нормальную строку не помечает как проблемную', () => {
    const once = 'user=%7B%22id%22%3A42%7D&auth_date=1&hash=abc';
    expect(describeInitDataShape(once)!.stillEncoded).toBe(false);
    expect(formatInitDataShape(describeInitDataShape(once)!)).toContain(
      'кодировка внутри: снята',
    );
  });

  it('пустая или бессмысленная строка — показывать нечего', () => {
    expect(describeInitDataShape('')).toBeNull();
    expect(describeInitDataShape('мусор-без-пар')).toBeNull();
  });

  it('длина строки видна — по ней отличают обрезанную подпись', () => {
    expect(describeInitDataShape('a=1&hash=abc')!.length).toBe(12);
  });
});
