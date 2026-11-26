// @vitest-environment jsdom
// Темы дня «сохранил → нашёл» (аудит 2026-11, today-history-day): заметка сохраняет id тем,
// выбранных чипами NoteTagsPicker, а вид «День» показывал их сырыми — «work», «creativity».
// Теперь обе стороны берут один список shared/src/notes/noteTags.ts.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { NoteTagsPicker } from '../NoteTagsPicker';
import { DayNote } from './DayNote';

describe('темы дня: выбор в заметке → подписи в истории', () => {
  it('выбранные чипы дают id, история показывает их подписи, а не id', () => {
    const saved = new Set<string>();
    render(<NoteTagsPicker selectedTags={saved} onToggle={(id) => saved.add(id)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Работа' }));
    fireEvent.click(screen.getByRole('button', { name: 'Творчество' }));
    expect([...saved]).toEqual(['work', 'creativity']);
    cleanup();

    const { container } = render(<DayNote text="Вечером рисовала" tags={[...saved]} onOpen={vi.fn()} />);
    expect(screen.getByText('Работа')).toBeTruthy();
    expect(screen.getByText('Творчество')).toBeTruthy();
    expect(container.textContent).not.toMatch(/work|creativity/);
  });

  it('выбранный чип — нажат (aria-pressed), невыбранный — нет', () => {
    render(<NoteTagsPicker selectedTags={new Set(['joy'])} onToggle={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Радость' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Тело' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('пустая заметка — приглашение и тап открывает лист', () => {
    const onOpen = vi.fn();
    render(<DayNote text={null} tags={[]} onOpen={onOpen} />);
    fireEvent.click(screen.getByText('Добавить заметку к этому дню'));
    expect(onOpen).toHaveBeenCalledTimes(1);
    // glue: «к» не висит в конце строки — пробел после него неразрывный
    expect(screen.getByText('Добавить заметку к этому дню').textContent).toContain('к\u00a0этому');
  });

  // Ревью g3 r5: заметка — текст самого человека; glue менял в нём дефис на U+2011 и тире диапазона на U+2060.
  it('текст заметки — дефисы и тире как ввёл человек, склеены только пробелы', () => {
    const { container } = render(<DayNote text="Кто-то позвонил в 3–5 часов" tags={[]} onOpen={vi.fn()} />);
    expect(container.textContent).toContain('Кто-то позвонил в\u00a03–5 часов');
    expect(container.textContent).not.toMatch(/[\u2011\u2060]/);
  });
});
