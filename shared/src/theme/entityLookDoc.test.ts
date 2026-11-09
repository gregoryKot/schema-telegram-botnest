// Таблица вида словами (docs/design/APP_2026-11.md, «ENTITY_LOOK словами») и ENTITY_LOOK в коде —
// два места, которые обязаны совпадать (правило №4). Без сверки они разъехались молча: в документе
// у «Что питает» и «Плана на завтра» стояли NEED_HUE и NeedArt, в коде — 145/leaf и 135/check, и
// партия b20 не знала бы, какой вид правильный (ревью волны 0, круг 2).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { ENTITY_LOOK, type EntityId } from './entityLook';

const DOC = readFileSync(
  join(__dirname, '../../../docs/design/APP_2026-11.md'),
  'utf8',
);
const from = DOC.indexOf('## ENTITY_LOOK словами');
const SECTION = DOC.slice(from, DOC.indexOf('\n## ', from + 1));

/** Строки таблиц раздела: ячейки без краёв; шапка и разделитель отброшены. */
const ROWS = SECTION.split('\n')
  .filter(
    (l) =>
      l.startsWith('| ') &&
      !l.startsWith('| Сущность') &&
      !l.startsWith('|---'),
  )
  .map((l) =>
    l
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim()),
  );

/** Строка документа (начало первой ячейки) → сущность кода. Несколько сущностей на строку — можно. */
const ROW_OF: Record<string, EntityId[]> = {
  Трекер: ['tracker'],
  'Заметка к дню': ['note'],
  '«Что случилось»': ['case'],
  'Быстрая запись': ['diary'],
  'Дневник схем': ['diary_schema'],
  'Дневник режимов': ['diary_mode'],
  Благодарность: ['gratitude'],
  'Схемы вообще': ['schemas', 'ysq'],
  'Режимы вообще': ['modes'],
  Дыхание: ['breathing'],
  Заземление: ['grounding'],
  '«Стоп»': ['stop'],
  '«Мне плохо»': ['sos'],
  '01 Проверка убеждения': ['belief_check'],
  '02 Карточка схемы': ['schema_card'],
  '03 Карточка режима': ['mode_card'],
  '04 Письмо': ['letter'],
  '05 Безопасное место': ['safe_place'],
  '06 Колесо детства': ['childhood_wheel'],
  '07 Тёплые слова': ['warm_words'],
  'Тёплые слова в профиле': ['warm_words'],
  '08 «Критик или забота?»': ['phrase_check'],
  '«Что питает»': ['nourish'],
  'План на завтра': ['plan'],
  Профиль: ['profile'],
  '«Мой путь»': ['journey'],
  'Мой портрет': ['portrait'],
};

/** Сущности без своей строки в таблицах — с причиной (вид записан абзацами под таблицами). */
const OUTSIDE_TABLES: Partial<Record<EntityId, string>> = {
  task: 'строка «Цель, задание» описывает TaskSign по типу; своё задание — «своё — 240» там же',
  therapist:
    'абзацы «Меню, ⌘K, объединение» и «Кабинет терапевта»: Talk на небе',
  pair: 'абзац «Кабинет терапевта»: приглашение в пару — NeedArt attachment',
  settings: 'абзац «Меню»: Ещё — Beads',
};

/** `HeartFrame` → heart_frame; первое слово в обратных кавычках ячейки знака. */
const signOf = (cell: string) =>
  cell
    .match(/`([A-Za-z]+)/)?.[1]
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .toLowerCase();

const rowFor = (name: string) => ROWS.filter((r) => r[0].startsWith(name));

describe('ENTITY_LOOK словами ↔ ENTITY_LOOK в коде', () => {
  it('у каждой строки сверки — ровно одна строка документа', () => {
    expect(ROWS.length).toBeGreaterThan(20);
    for (const name of Object.keys(ROW_OF))
      expect(rowFor(name), name).toHaveLength(1);
  });

  it('оттенок и знак строки документа — те же, что в коде', () => {
    for (const [name, ids] of Object.entries(ROW_OF)) {
      const [row] = rowFor(name);
      for (const id of ids) {
        expect(Number(row[1].match(/^\d+/)?.[0]), `${name} → ${id}: --h`).toBe(
          ENTITY_LOOK[id].hue,
        );
        expect(signOf(row[2]), `${name} → ${id}: знак`).toBe(
          ENTITY_LOOK[id].sign,
        );
      }
    }
  });

  it('каждая сущность кода — в таблице словами или в списке «вне таблиц» с причиной', () => {
    const covered = new Set(Object.values(ROW_OF).flat());
    for (const id of Object.keys(ENTITY_LOOK) as EntityId[]) {
      expect(covered.has(id) || Boolean(OUTSIDE_TABLES[id]), id).toBe(true);
      expect(
        covered.has(id) && Boolean(OUTSIDE_TABLES[id]),
        `${id}: и в таблице, и вне`,
      ).toBe(false);
    }
  });

  it('контрольный образец: расхождение оттенка сверка ловит', () => {
    const [row] = rowFor('План на завтра');
    expect(Number(row[1].match(/^\d+/)?.[0])).not.toBe(ENTITY_LOOK.task.hue);
  });
});
