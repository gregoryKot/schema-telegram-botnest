// @vitest-environment jsdom
// QA 2026-11 (A-М9): запись в 6700 знаков в ленте «Записи» выводилась целиком —
// простыня на экран и больше. В закрытой карточке — начало и «показать ещё»,
// по нажатию — целиком; короткая запись не меняется.
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { clipPreview, PREVIEW_MAX } from './entryPreview';
import { SchemaEntry, ModeEntry } from './EntryCards';
import type { ModeDiaryEntry, SchemaDiaryEntry } from '../../types';

afterEach(cleanup);

const LONG = 'Слово '.repeat(1200).trim(); // ~7200 знаков

describe('clipPreview', () => {
  it('короткий текст — как есть', () => {
    expect(clipPreview('Созвон с командой')).toEqual({ text: 'Созвон с командой', clipped: false });
    const exact = 'а'.repeat(PREVIEW_MAX);
    expect(clipPreview(exact)).toEqual({ text: exact, clipped: false });
  });

  it('длинный — до границы слова, с многоточием, не длиннее предела', () => {
    const { text, clipped } = clipPreview(LONG);
    expect(clipped).toBe(true);
    expect(text.endsWith('Слово…')).toBe(true);
    expect(text.length).toBeLessThanOrEqual(PREVIEW_MAX + 1);
  });

  it('одно длинное слово без пробелов режется по пределу, а не пропадает', () => {
    const { text } = clipPreview('ы'.repeat(1000));
    expect(text).toBe('ы'.repeat(PREVIEW_MAX) + '…');
  });

  it('хвостовые знаки препинания перед многоточием убираются', () => {
    const t = 'а'.repeat(250) + ', ' + 'б'.repeat(100);
    expect(clipPreview(t).text).toBe('а'.repeat(250) + '…');
  });
});

describe('Лента «Записи»: длинная запись свёрнута до нажатия', () => {
  it('дневник схем: начало и «показать ещё»; нажатие — текст целиком', () => {
    const entry: SchemaDiaryEntry = { id: 1, createdAt: new Date().toISOString(), trigger: LONG, emotions: [], schemaIds: [] };
    render(<SchemaEntry entry={entry} onDelete={() => {}} />);
    const card = screen.getByRole('button', { expanded: false });
    expect(screen.getByText('показать ещё')).toBeTruthy();
    expect(card.textContent!.length).toBeLessThan(PREVIEW_MAX + 100);
    fireEvent.click(card);
    expect(screen.queryByText('показать ещё')).toBeNull();
    expect(card.textContent).toContain(LONG);
  });

  it('дневник режимов: то же для ситуации', () => {
    const entry: ModeDiaryEntry = { id: 1, createdAt: new Date().toISOString(), modeId: 'vulnerable-child', situation: LONG };
    render(<ModeEntry entry={entry} onDelete={() => {}} />);
    expect(screen.getByText('показать ещё')).toBeTruthy();
  });

  it('контрольный: короткая запись — без «показать ещё»', () => {
    const entry: SchemaDiaryEntry = { id: 1, createdAt: new Date().toISOString(), trigger: 'Созвон с командой', emotions: [], schemaIds: [] };
    render(<SchemaEntry entry={entry} onDelete={() => {}} />);
    expect(screen.getByText('Созвон с командой')).toBeTruthy();
    expect(screen.queryByText('показать ещё')).toBeNull();
  });
});
