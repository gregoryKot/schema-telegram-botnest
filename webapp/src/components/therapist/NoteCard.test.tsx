// @vitest-environment jsdom
// Карточка записи клиента (#906): на телефоне заголовок — своей строкой под
// чипом и датой, перенос по слову (break-word), а не в любом месте (anywhere):
// в одной строке с чипом и датой ему оставалось ~150px и «Благодарность»
// рвалась на «Благодарност/ь». CSS в jsdom не исполняется — сверяем строки
// therapist-tabs.css (приём safeTop.test.ts) и классы разметки.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NoteCard } from './NoteCard';
import type { NoteItem } from './notesModel';

afterEach(cleanup);

const item: NoteItem = {
  key: 'g-1', kind: 'gratitude', typeLabel: 'Дневник', title: 'Благодарность', date: '2026-10-02',
  excerpt: 'спасибо за день', fields: [],
};

describe('NoteCard', () => {
  it('заголовок — tb-note-title, дата сразу за ним — tb-note-date; клик по карточке зовёт onToggle', () => {
    const onToggle = vi.fn();
    render(<NoteCard item={item} expanded={false} onToggle={onToggle} />);
    const title = screen.getByText('Благодарность');
    expect(title.classList.contains('tb-note-title')).toBe(true);
    expect(title.nextElementSibling?.classList.contains('tb-note-date')).toBe(true);
    fireEvent.click(title);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('therapist-tabs.css: заголовок переносится по слову, на телефоне — своей строкой, дата у правого края', () => {
    const css = readFileSync(join(__dirname, '../../styles/therapist-tabs.css'), 'utf8');
    const phoneAt = css.indexOf('@media (max-width: 767px)');
    expect(phoneAt).toBeGreaterThan(0);
    const base = css.slice(0, phoneAt);
    const phone = css.slice(phoneAt);
    expect(base).toMatch(/\.tb-note-title \{[^}]*overflow-wrap: break-word/);
    expect(base).not.toMatch(/\.tb-note-title \{[^}]*anywhere/);
    expect(phone).toMatch(/\.tb-note-title \{[^}]*flex-basis: 100%/);
    expect(phone).toMatch(/\.tb-note-date \{[^}]*margin-left: auto/);
  });
});
