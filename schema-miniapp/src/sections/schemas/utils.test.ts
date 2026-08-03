// @vitest-environment jsdom
// Чистые утилиты каталога схем (цвета, короткие имена, чтение локальных id).
// Логика с ветвлениями — обязана быть под тестом (правило CLAUDE.md).
import { describe, it, expect, beforeEach } from 'vitest';
import { cm, hex, readLocalIds, shortName, needScoreColor } from './utils';

describe('cm', () => {
  it('строит color-mix с заданным процентом прозрачности', () => {
    expect(cm('var(--accent-red)', 15)).toBe(
      'color-mix(in srgb, var(--accent-red) 15%, transparent)',
    );
  });
});

describe('hex', () => {
  it('резолвит известную CSS-переменную в HEX', () => {
    expect(hex('var(--accent-green)')).toBe('#4ade80');
  });

  it('неизвестный цвет возвращает как есть (фолбэк)', () => {
    expect(hex('#123456')).toBe('#123456');
  });
});

describe('readLocalIds', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('на чистом localStorage возвращает пустой массив, а не мусор', () => {
    expect(readLocalIds('some_key')).toEqual([]);
  });

  it('читает ранее сохранённые id (read-after-write)', () => {
    localStorage.setItem('my_ids', JSON.stringify(['a', 'b']));
    expect(readLocalIds('my_ids')).toEqual(['a', 'b']);
  });

  it('битый JSON не роняет чтение', () => {
    localStorage.setItem('broken', '{не json');
    expect(readLocalIds('broken')).toEqual([]);
  });
});

describe('shortName', () => {
  it('берёт часть до " / " и сокращает длинные типовые слова', () => {
    expect(shortName('Эмоциональная депривация / что-то ещё')).toBe(
      'Эмоц. депривация',
    );
    expect(shortName('Социальная изоляция')).toBe('Соц. изоляция');
    expect(shortName('Недостаточность самоконтроля')).toBe(
      'Недост. самоконтроля',
    );
  });

  it('без совпадений возвращает имя без изменений', () => {
    expect(shortName('Покинутость')).toBe('Покинутость');
  });
});

describe('needScoreColor', () => {
  it('низкая оценка (<=3) — красный', () => {
    expect(needScoreColor(2)).toBe('var(--accent-red)');
    expect(needScoreColor(3)).toBe('var(--accent-red)');
  });

  it('средняя оценка (4-6) — жёлтый', () => {
    expect(needScoreColor(4)).toBe('var(--accent-yellow)');
    expect(needScoreColor(6)).toBe('var(--accent-yellow)');
  });

  it('высокая оценка (>6) — зелёный', () => {
    expect(needScoreColor(7)).toBe('var(--accent-green)');
    expect(needScoreColor(10)).toBe('var(--accent-green)');
  });
});
