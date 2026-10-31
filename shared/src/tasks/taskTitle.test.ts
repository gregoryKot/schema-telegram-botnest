// Название задания — единственная копия резолвера (правило №3). Кейсы
// собраны из тестов четырёх бывших копий: taskEmoji.test.ts и
// TaskCreateSheet.test.tsx мини-аппа, today/helpers.test.ts сайта.
// Регрессия: терапевт в карточке клиента видел «invincible_oc» — сырой id
// режима — вместо названия задания.
import { describe, it, expect } from 'vitest';
import {
  getTaskDisplayText,
  findLegacyTaskTarget,
  resolveTaskDisplayText,
} from './taskTitle';
import { ALL_SCHEMAS, ALL_MODES } from '../schemaTherapy/schemaTherapyData';

const FIRST_SCHEMA = ALL_SCHEMAS[0];
const FIRST_MODE = ALL_MODES[0];

describe('getTaskDisplayText — читаемое название по типу задания', () => {
  it('schema_intro резолвит id в реальное название схемы', () => {
    expect(getTaskDisplayText('schema_intro', FIRST_SCHEMA.id)).toBe(
      `Карточка схемы: ${FIRST_SCHEMA.name}`,
    );
  });

  it('schema_intro с неизвестным id — фолбэк без выдуманного названия', () => {
    expect(getTaskDisplayText('schema_intro', 'not-a-real-id')).toBe(
      'Карточка схемы',
    );
  });

  it('mode_intro резолвит id в реальное название режима', () => {
    expect(getTaskDisplayText('mode_intro', FIRST_MODE.id)).toBe(
      `Карточка режима: ${FIRST_MODE.name}`,
    );
  });

  it('mode_intro с неизвестным id — фолбэк без выдуманного названия', () => {
    expect(getTaskDisplayText('mode_intro', 'not-a-real-id')).toBe(
      'Карточка режима',
    );
  });

  it('прочие типы — текст как есть', () => {
    expect(getTaskDisplayText('custom', 'Пить воду')).toBe('Пить воду');
  });
});

describe('resolveTaskDisplayText', () => {
  it('mode_intro + invincible_oc — название режима, не сырой id', () => {
    const task = { type: 'mode_intro', text: 'invincible_oc' };
    expect(resolveTaskDisplayText(task)).toBe(
      'Карточка режима: Неуязвимый Гиперконтролёр',
    );
  });

  it('schema_intro — полный вариант с типизированным текстом', () => {
    const task = { type: 'schema_intro', text: FIRST_SCHEMA.id };
    expect(resolveTaskDisplayText(task, 'full')).toBe(
      `Карточка схемы: ${FIRST_SCHEMA.name}`,
    );
  });

  it('schema_intro — compact тоже с префиксом (префикс снимается только у старого формата)', () => {
    const task = { type: 'schema_intro', text: 'abandonment' };
    expect(resolveTaskDisplayText(task, 'compact')).toBe(
      'Карточка схемы: Покинутость / Нестабильность',
    );
  });

  it('легаси raw schema id — full добавляет префикс, compact — только имя', () => {
    const task = { type: 'legacy', text: FIRST_SCHEMA.id };
    expect(resolveTaskDisplayText(task, 'full')).toBe(
      `Карточка схемы: ${FIRST_SCHEMA.name}`,
    );
    expect(resolveTaskDisplayText(task, 'compact')).toBe(FIRST_SCHEMA.name);
  });

  it('легаси raw mode id — full добавляет префикс, compact — только имя', () => {
    const task = { type: 'custom', text: 'vulnerable_child' };
    expect(resolveTaskDisplayText(task, 'full')).toBe(
      'Карточка режима: Уязвимый Ребёнок',
    );
    expect(resolveTaskDisplayText(task, 'compact')).toBe('Уязвимый Ребёнок');
  });

  it('по умолчанию — вариант full', () => {
    const task = { type: 'custom', text: 'abandonment' };
    expect(resolveTaskDisplayText(task)).toBe(
      'Карточка схемы: Покинутость / Нестабильность',
    );
  });

  it('обычный custom-текст возвращается как есть в обоих вариантах', () => {
    const task = { type: 'custom', text: 'Погулять 20 минут' };
    expect(resolveTaskDisplayText(task, 'full')).toBe('Погулять 20 минут');
    expect(resolveTaskDisplayText(task, 'compact')).toBe('Погулять 20 минут');
  });
});

describe('findLegacyTaskTarget', () => {
  it('null для текста, который не является id схемы/режима', () => {
    expect(findLegacyTaskTarget('точно не id')).toBeNull();
  });

  it('находит схему по id', () => {
    expect(findLegacyTaskTarget(FIRST_SCHEMA.id)).toEqual({
      type: 'schema',
      id: FIRST_SCHEMA.id,
      name: FIRST_SCHEMA.name,
    });
  });

  it('находит режим по id', () => {
    expect(findLegacyTaskTarget(FIRST_MODE.id)).toEqual({
      type: 'mode',
      id: FIRST_MODE.id,
      name: FIRST_MODE.name,
    });
  });
});
