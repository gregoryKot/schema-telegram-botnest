// @vitest-environment jsdom
// Аккордеон домена/группы (MapFold) — одна механика на «Полную карту», «Карту режимов» и вкладку «Схемы»
// справочника (ревью g5 r1): свёрнут по умолчанию или управляем снаружи, своя — с галочкой, плитка из
// результата теста — приподнята и подъезжает в окно, плитки справочника — текст без тапа.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MapFold } from './MapFold';

afterEach(cleanup);

const TILES = [
  { id: 'a', name: 'Схема А', desc: 'описание А', isMine: true },
  { id: 'b', name: 'Схема Б', desc: 'описание Б', isMine: false },
];

describe('MapFold', () => {
  it('свёрнут по умолчанию; шапка раскрывает и сворачивает плитки', () => {
    render(<MapFold look={{ hue: 28, sign: 'domain_rejection' }} title="Домен" meta="1 из 2 отмечены" tiles={TILES} onOpen={vi.fn()} />);
    const head = screen.getByRole('button', { name: /Домен/ });
    expect(head.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Схема А')).toBeNull();
    fireEvent.click(head);
    expect(head.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Схема Б')).toBeTruthy();
    fireEvent.click(head);
    expect(screen.queryByText('Схема Б')).toBeNull();
  });

  it('своя — бумагой с галочкой (is-mine), чужая — без; тап открывает описание по id', () => {
    const open = vi.fn();
    render(<MapFold look={{ hue: 28 }} title="Домен" tiles={TILES} onOpen={open} />);
    fireEvent.click(screen.getByRole('button', { name: /Домен/ }));
    const mine = screen.getByRole('button', { name: /Схема А/ });
    const other = screen.getByRole('button', { name: /Схема Б/ });
    expect(mine.classList.contains('is-mine')).toBe(true);
    expect(mine.querySelector('.cs-tile-check')).toBeTruthy();
    expect(other.classList.contains('is-mine')).toBe(false);
    expect(other.querySelector('.cs-tile-check')).toBeNull();
    fireEvent.click(other);
    expect(open).toHaveBeenCalledWith('b');
  });

  it('управляемое раскрытие: open снаружи, тап по шапке зовёт onToggle', () => {
    const toggle = vi.fn();
    const { rerender } = render(<MapFold look={{ hue: 28 }} title="Домен" tiles={TILES} open={false} onToggle={toggle} />);
    fireEvent.click(screen.getByRole('button', { name: /Домен/ }));
    expect(toggle).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Схема А')).toBeNull(); // сам не раскрывается
    rerender(<MapFold look={{ hue: 28 }} title="Домен" tiles={TILES} open onToggle={toggle} />);
    expect(screen.getByText('Схема А')).toBeTruthy();
  });

  it('без onOpen плитки — текст, не кнопки; плитка из результата приподнята и подъезжает в окно один раз', () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    const { rerender } = render(<MapFold look={{ hue: 28 }} title="Домен" tiles={TILES} open highlightId="b" />);
    expect(screen.getAllByRole('button')).toHaveLength(1); // только шапка
    const hl = screen.getByText('Схема Б').closest('.cs-tile')!;
    expect(hl.classList.contains('is-hl')).toBe(true);
    expect(hl.getAttribute('aria-current')).toBe('true');
    expect(screen.getByText('Схема А').closest('.cs-tile')!.getAttribute('aria-current')).toBeNull();
    expect(scroll).toHaveBeenCalledTimes(1);
    rerender(<MapFold look={{ hue: 28 }} title="Домен" tiles={TILES} open highlightId="b" />);
    expect(scroll).toHaveBeenCalledTimes(1);
  });

  it('название склеено: короткое слово не висит в конце строки («на других», «и подавление»)', () => {
    const { container } = render(<MapFold look={{ hue: 240 }} title="Направленность на других" tiles={TILES} />);
    expect(container.querySelector('.cs-mapfold-name')!.textContent).toBe('Направленность на\u00a0других');
  });
});
