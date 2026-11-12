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
import { PHONE_MEDIA } from '../../utils/phoneLayout';

afterEach(cleanup);

const item: NoteItem = {
  key: 'g-1', kind: 'gratitude', typeLabel: 'Дневник', title: 'Благодарность', date: '2026-10-02',
  excerpt: 'спасибо за день', fields: [],
};

describe('NoteCard', () => {
  it('заголовок — tb-note-title, под ним тип тихой подписью, дата — в строке справа; клик по карточке зовёт onToggle', () => {
    const onToggle = vi.fn();
    render(<NoteCard item={item} expanded={false} onToggle={onToggle} />);
    const title = screen.getByText('Благодарность');
    expect(title.classList.contains('tb-note-title')).toBe(true);
    expect(title.nextElementSibling?.classList.contains('tb-note-type')).toBe(true);
    expect(title.parentElement?.nextElementSibling?.classList.contains('tb-note-date')).toBe(true);
    fireEvent.click(title);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('therapist-tabs.css: заголовок переносится по слову в своей колонке сетки (знак · заголовок · дата)', () => {
    const css = readFileSync(join(__dirname, '../../styles/therapist-tabs.css'), 'utf8');
    expect(css.indexOf(`@media ${PHONE_MEDIA}`)).toBeGreaterThan(0);
    expect(css).toMatch(/\.tb-note-title \{[^}]*overflow-wrap: break-word/);
    expect(css).not.toMatch(/\.tb-note-title \{[^}]*anywhere/);
    expect(css).toMatch(/\.tb-note-head \{[^}]*grid-template-columns: 44px minmax\(0, 1fr\) auto/);
  });

  // b31: знак и бумага — по типу записи (noteLook), а не одни камешки на мху у каждой карточки; r1 — без таблетки.
  it('тень листа — бумага своего типа: благодарность 195, схема 28, режим 240; знак у схемы — не камешки; таблетки нет', () => {
    const hueOf = (kind: NoteItem['kind']) => {
      const { container } = render(<NoteCard item={{ ...item, kind }} expanded={false} onToggle={vi.fn()} />);
      expect(container.querySelector('.pp-tag')).toBeNull();
      const tag = container.querySelector<HTMLElement>('.pp-leaf.tb-note')!;
      const art = container.querySelector('.pp-row-art')!.innerHTML;
      cleanup();
      return { h: tag.style.getPropertyValue('--h'), art };
    };
    const g = hueOf('gratitude'), s = hueOf('schema'), m = hueOf('mode');
    expect([g.h, s.h, m.h]).toEqual(['195', '28', '240']);
    expect(new Set([g.art, s.art, m.art]).size).toBe(3);
  });
});
