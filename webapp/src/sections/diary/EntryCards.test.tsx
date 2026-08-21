// @vitest-environment jsdom
// Ж7 дизайн-аудита 2026-08: карточки записей дневника — раскрывашки
// (клик разворачивает подробности) без aria-expanded. Проверяем все три
// (схема/режим/благодарность) по одному образцу.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SchemaEntry, ModeEntry, GratitudeEntry } from './EntryCards';
import type {
  SchemaDiaryEntry,
  ModeDiaryEntry,
  GratitudeDiaryEntry,
} from '../../types';

afterEach(cleanup);

const SCHEMA_ENTRY: SchemaDiaryEntry = {
  id: 1,
  createdAt: new Date().toISOString(),
  trigger: 'Созвон с командой',
  emotions: [],
  schemaIds: [],
};

const MODE_ENTRY: ModeDiaryEntry = {
  id: 1,
  createdAt: new Date().toISOString(),
  modeId: 'vulnerable-child',
  situation: 'Позвонил папа',
};

const GRATITUDE_ENTRY: GratitudeDiaryEntry = {
  id: 1,
  date: '2026-08-01',
  items: ['Тёплый чай'],
  createdAt: new Date().toISOString(),
};

describe('EntryCards — aria-expanded на раскрывашках (Ж7)', () => {
  it('SchemaEntry: aria-expanded переключается по клику', () => {
    render(<SchemaEntry entry={SCHEMA_ENTRY} onDelete={() => {}} />);
    const card = screen.getByText('Созвон с командой').closest('[role="button"]')!;
    expect(card.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(card);
    expect(card.getAttribute('aria-expanded')).toBe('true');
  });

  it('ModeEntry: aria-expanded переключается по клику', () => {
    render(<ModeEntry entry={MODE_ENTRY} onDelete={() => {}} />);
    const card = screen.getByText('Позвонил папа').closest('[role="button"]')!;
    expect(card.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(card);
    expect(card.getAttribute('aria-expanded')).toBe('true');
  });

  it('GratitudeEntry: aria-expanded переключается по клику', () => {
    render(<GratitudeEntry entry={GRATITUDE_ENTRY} onDelete={() => {}} />);
    const card = screen.getByText('Тёплый чай').closest('[role="button"]')!;
    expect(card.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(card);
    expect(card.getAttribute('aria-expanded')).toBe('true');
  });
});
