// @vitest-environment jsdom
// «Зачем это?» у заметки к дню (принцип 5 docs/design/APP_2026-11.md): на телефоне свёрнуто —
// до поля только шапка; на компьютере раскрыто под листом. Раскрывается тапом.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NoteWhy } from './NoteWhy';

const BODY = /Регулярные короткие записи/;
function layout(phone: boolean) {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: phone && q.includes('max-width: 767px'), media: q }));
}
afterEach(() => vi.unstubAllGlobals());

describe('NoteWhy', () => {
  it('телефон: свёрнуто, тап раскрывает и сворачивает', () => {
    layout(true);
    render(<NoteWhy />);
    const btn = screen.getByRole('button', { name: /Зачем это/ });
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText(BODY)).toBeNull();
    fireEvent.click(btn);
    expect(screen.getByText(BODY)).toBeTruthy();
    fireEvent.click(btn);
    expect(screen.queryByText(BODY)).toBeNull();
  });

  it('компьютер: раскрыто сразу', () => {
    layout(false);
    render(<NoteWhy />);
    expect(screen.getByRole('button', { name: /Зачем это/ }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText(BODY)).toBeTruthy();
  });
});
