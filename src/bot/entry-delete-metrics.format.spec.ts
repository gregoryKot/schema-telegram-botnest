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

  it('неизвестный тип не роняет отчёт — печатается как есть', () => {
    const text = formatEntryDeleteMetrics({
      ...FULL,
      byType30: [{ type: 'новый_тип', count: 1 }],
    });
    expect(text).toContain('новый_тип — 1');
  });
});
