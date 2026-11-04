// QA клиента 2026-11, М1: ярлык типа записи — один для главной и «Записей».
import { describe, it, expect } from 'vitest';
import { ENTRY_KIND_LABEL, modeEntryKind, schemaEntryKind } from './entryKind';

describe('entryKind', () => {
  it('запись схем без схем и чувств — «Мысль», со схемой или чувством — «Схема»', () => {
    expect(ENTRY_KIND_LABEL[schemaEntryKind({ schemaIds: [], emotions: [] })]).toBe('Мысль');
    expect(ENTRY_KIND_LABEL[schemaEntryKind({ schemaIds: ['abandonment'], emotions: [] })]).toBe('Схема');
    expect(ENTRY_KIND_LABEL[schemaEntryKind({ schemaIds: [], emotions: [{ id: 'fear' }] })]).toBe('Схема');
  });

  it('запись режима из «Что случилось» — «Разбор», обычная — «Режим»', () => {
    expect(ENTRY_KIND_LABEL[modeEntryKind({ fromCase: true })]).toBe('Разбор');
    expect(ENTRY_KIND_LABEL[modeEntryKind({ fromCase: false })]).toBe('Режим');
    expect(ENTRY_KIND_LABEL[modeEntryKind({})]).toBe('Режим');
  });
});
