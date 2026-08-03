/**
 * MergeService — белый список SQL-идентификаторов и сверка реестров между собой
 * (docs/TEST_TRUST_PLAN.md, раздел «Дальше»).
 *
 * Почему отдельный файл. Слияние аккаунтов — единственное место проекта, где
 * имя таблицы и колонки подставляется в SQL текстом (`Prisma.raw`), потому что
 * список таблиц перебирается в цикле. Защита от этого — `ident()`: имя вне
 * белого списка не доезжает до базы. Мутационный прогон волны А показал, что
 * сама защита тестами не тронута: `ident()` не экспортировался, и снаружи до
 * него было не добраться — то есть проверку можно было выпотрошить, а CI
 * остался бы зелёным. Функция и реестры теперь экспортируются ради этого теста.
 *
 * Второй класс бага, который тут ловится, — рассинхрон реестров (правило №4
 * CLAUDE.md). `UNIQUE_RULES` и `USER_OWNED_TABLES` наполняются руками, а
 * `ident()` бросает на незнакомом имени. Таблица, добавленная в правила и
 * забытая в белом списке, не «просто не сработает»: merge упадёт с исключением
 * ПОСРЕДИ переноса данных живого человека. Дешевле поймать сверкой списков.
 */

import {
  ident,
  KNOWN_COLS,
  KNOWN_TABLES,
  SECURITY_SENSITIVE_TABLES,
  UNIQUE_RULES,
  USER_OWNED_TABLES,
} from './merge.service';

describe('MergeService: белый список идентификаторов (ident)', () => {
  it('известную таблицу возвращает в кавычках — чтобы Postgres не понижал регистр', () => {
    // Без кавычек Postgres сложит "Rating" в rating и не найдёт таблицу:
    // кавычки тут не косметика, а условие работоспособности запроса.
    expect(ident('Rating', 'table')).toBe('"Rating"');
    expect(ident('userId', 'col')).toBe('"userId"');
  });

  it('незнакомую таблицу отвергает, а не подставляет в SQL', () => {
    expect(() => ident('Users; DROP TABLE "User"', 'table')).toThrow(
      /unknown SQL identifier/i,
    );
    expect(() => ident('Rating', 'col')).toThrow(/unknown SQL identifier/i);
  });

  it('реестры таблиц и колонок не пересекаются по назначению', () => {
    // Имя таблицы, случайно попавшее в список колонок (или наоборот), делает
    // защиту дырявой: `ident()` пропустит идентификатор не того рода.
    for (const table of KNOWN_TABLES) {
      expect(KNOWN_COLS.has(table)).toBe(false);
    }
  });

  it('в белом списке колонок нет ничего, кроме идентификаторов', () => {
    // Пробел, кавычка или скобка внутри разрешённого имени = возможность
    // дописать произвольный SQL: имя подставляется без экранирования.
    for (const name of [...KNOWN_TABLES, ...KNOWN_COLS]) {
      expect(name).toMatch(/^[A-Za-z][A-Za-z0-9]*$/);
    }
  });
});

describe('MergeService: реестры обязаны совпадать между собой', () => {
  it('каждая таблица из UNIQUE_RULES разрешена в ident()', () => {
    // Иначе merge упадёт исключением на середине переноса: часть данных уже
    // переехала, часть — нет.
    const missing = UNIQUE_RULES.map((r) => r.table).filter(
      (t) => !KNOWN_TABLES.has(t),
    );
    expect(missing).toEqual([]);
  });

  it('каждая колонка из UNIQUE_RULES разрешена в ident()', () => {
    const missing = UNIQUE_RULES.flatMap((r) => r.cols).filter(
      (c) => !KNOWN_COLS.has(c),
    );
    expect(missing).toEqual([]);
  });

  it('каждая переносимая и каждая удаляемая таблица разрешена в ident()', () => {
    const missing = [
      ...USER_OWNED_TABLES,
      ...SECURITY_SENSITIVE_TABLES,
    ].filter((t) => !KNOWN_TABLES.has(t));
    expect(missing).toEqual([]);
  });

  it('таблица не может одновременно переноситься и удаляться', () => {
    // Пересечение списков означает неопределённость: строки source сначала
    // удалят, потом попытаются перенести (или наоборот) — исход зависит от
    // порядка кода, а не от решения.
    const both = USER_OWNED_TABLES.filter((t) =>
      (SECURITY_SENSITIVE_TABLES as readonly string[]).includes(t),
    );
    expect(both).toEqual([]);
  });

  it('в UNIQUE_RULES нет дублей по таблице', () => {
    // Дубль означает, что второе правило молча не действует: конфликтующие
    // строки останутся и уронят массовый UPDATE на unique-констрейнте.
    const tables = UNIQUE_RULES.map((r) => r.table);
    expect(tables).toHaveLength(new Set(tables).size);
  });
});
