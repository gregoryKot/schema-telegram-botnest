// Форматтер блока «Удаление своих записей» в /stats: полные данные, пустая
// БД (без NaN и голых ключей), подписи типов без словаря и сверка с
// реестром ENTRY_DELETE_TYPES — новый тип без подписи вылезло бы в отчёт как id.
import {
  formatEntryDeleteMetrics,
  ENTRY_DELETE_TYPE_LABELS,
  EntryDeleteMetrics,
} from './entry-delete-metrics.format';
import { ENTRY_DELETE_TYPES } from '../analytics/entry-delete.constants';

const FULL: EntryDeleteMetrics = {
  deleted30: 12,
  users30: 6,
  byType30: [
    { type: 'belief_check', count: 7 },
    { type: 'letter', count: 3 },
    { type: 'flashcard', count: 2 },
  ],
};

const EMPTY: EntryDeleteMetrics = {
  deleted30: 0,
  users30: 0,
  byType30: [],
};

describe('formatEntryDeleteMetrics', () => {
  it('полные данные: сколько удалили записей, людей, разбивка по типам', () => {
    const text = formatEntryDeleteMetrics(FULL);
    expect(text).toContain('Удалили записей: 12 · людей: 6');
    expect(text).toContain('проверка убеждения — 7');
    expect(text).toContain('письмо себе — 3');
    expect(text).toContain('кризисная карточка — 2');
    // Язык отчёта — без терминов и внутренних id (правило №8).
    expect(text).not.toMatch(/belief_check|flashcard|entry_deleted/i);
  });

  it('пустая БД: дружелюбная строка, без NaN/undefined', () => {
    const text = formatEntryDeleteMetrics(EMPTY);
    expect(text).toContain('Пока никто ничего не удалял.');
    expect(text).not.toMatch(/NaN|undefined/);
  });

  it('у каждого типа из реестра есть человеческая подпись', () => {
    for (const id of ENTRY_DELETE_TYPES) {
      expect(ENTRY_DELETE_TYPE_LABELS[id]).toBeTruthy();
    }
  });

  // Стёртый целиком тест схем (ysq_data_deleted, 2026-11): без строки воронка
  // теста не отличала «не дошёл» от «дошёл и стёр».
  it('стёртый тест: сколько раз, людей и сколько из них проходили тест', () => {
    const text = formatEntryDeleteMetrics(FULL, {
      deleted30: 3,
      users30: 2,
      completedUsers30: 2,
    });
    expect(text).toContain('Удалили записей: 12 · людей: 6');
    expect(text).toContain(
      'Стёрли результаты теста схем: 3 раза · людей: 2, из них проходили тест до конца: 2',
    );
    expect(text).not.toMatch(/ysq|attempts/i);
  });

  it('стёрли только тест — без «никто ничего не удалял» и без нулей', () => {
    const text = formatEntryDeleteMetrics(EMPTY, {
      deleted30: 1,
      users30: 1,
      completedUsers30: 0,
    });
    expect(text).not.toContain('Пока никто ничего не удалял.');
    expect(text).toContain('Отдельные записи пока никто не удалял.');
    expect(text).toContain('Стёрли результаты теста схем: 1 раз · людей: 1');
    expect(text).not.toContain('проходили тест');
  });

  it('пустая БД с нулевым тестом — та же одна строка', () => {
    const text = formatEntryDeleteMetrics(EMPTY, {
      deleted30: 0,
      users30: 0,
      completedUsers30: 0,
    });
    expect(text.split('\n')).toEqual([
      '🗑 <b>Удаление своих записей</b> (за месяц)',
      'Пока никто ничего не удалял.',
    ]);
  });

  it('неизвестный тип не роняет отчёт — печатается как есть', () => {
    const text = formatEntryDeleteMetrics({
      ...FULL,
      byType30: [{ type: 'новый_тип', count: 1 }],
    });
    expect(text).toContain('новый_тип — 1');
  });
});
