import { describe, it, expect } from 'vitest';
import {
  patternStatusText,
  schemaEntryCounts,
  modeEntryCounts,
} from './patternStatus';
import type { SchemaDiaryEntry, ModeDiaryEntry } from '../../types';

describe('patternStatusText', () => {
  it('пустая карточка — приглашение заполнить, без счётчика записей', () => {
    expect(patternStatusText(false, 0)).toBe('карточка пока пустая');
    expect(patternStatusText(false, 3)).toBe('карточка пока пустая');
  });

  it('заполненная карточка без записей дневника', () => {
    expect(patternStatusText(true, 0)).toBe('карточка заполнена');
  });

  it.each([
    [1, 'карточка заполнена · 1 запись'],
    [2, 'карточка заполнена · 2 записи'],
    [4, 'карточка заполнена · 4 записи'],
    [5, 'карточка заполнена · 5 записей'],
    [11, 'карточка заполнена · 11 записей'],
    [21, 'карточка заполнена · 21 запись'],
  ])('заполненная карточка с %i записями → «%s»', (count, expected) => {
    expect(patternStatusText(true, count)).toBe(expected);
  });
});

function schemaEntry(schemaIds: string[]): SchemaDiaryEntry {
  return {
    id: Math.random(),
    createdAt: '2026-01-01',
    trigger: 't',
    emotions: [],
    schemaIds,
  };
}

function modeEntry(modeId: string): ModeDiaryEntry {
  return { id: Math.random(), createdAt: '2026-01-01', modeId, situation: 's' };
}

describe('schemaEntryCounts', () => {
  it('запись с несколькими схемами считается в каждую', () => {
    const counts = schemaEntryCounts([
      schemaEntry(['abandonment', 'mistrust']),
      schemaEntry(['abandonment']),
    ]);
    expect(counts).toEqual({ abandonment: 2, mistrust: 1 });
  });

  it('пустой список записей — пустой объект счётчиков', () => {
    expect(schemaEntryCounts([])).toEqual({});
  });
});

describe('modeEntryCounts', () => {
  it('считает записи по modeId', () => {
    const counts = modeEntryCounts([
      modeEntry('demanding_critic'),
      modeEntry('demanding_critic'),
      modeEntry('vulnerable_child'),
    ]);
    expect(counts).toEqual({ demanding_critic: 2, vulnerable_child: 1 });
  });
});
