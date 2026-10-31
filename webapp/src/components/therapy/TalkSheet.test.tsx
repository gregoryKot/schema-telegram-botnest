// @vitest-environment jsdom
// Лист «Поговорить с кем-то»: кнопки шлют события с местом, «Назад» закрывает, цены нет.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TalkSheet } from './TalkSheet';

const track = vi.hoisted(() => vi.fn());
vi.mock('./trackTherapyNudge', () => ({ trackTherapyNudge: track }));

const goBack = vi.hoisted(() => vi.fn());
vi.mock('../../hooks/useHistorySheet', () => ({ useHistorySheet: () => goBack }));

const renderSheet = (trigger?: 'crisis') =>
  render(<MemoryRouter><TalkSheet place="more" trigger={trigger} onClose={vi.fn()} /></MemoryRouter>);

beforeEach(() => { localStorage.clear(); track.mockClear(); goBack.mockClear(); });
afterEach(cleanup);

describe('TalkSheet', () => {
  it('терапевт не подключён: запись с меткой места и Telegram автора, цены нет', () => {
    renderSheet();
    expect(screen.getByText('Поговорить с кем-то', { selector: '.ds-eyebrow' })).toBeTruthy();
    const book = screen.getByRole('link', { name: 'Записаться на встречу' });
    expect(book.getAttribute('href')).toBe('https://kotlarewski.gr/?from=app_more#booking');
    fireEvent.click(book);
    expect(track).toHaveBeenLastCalledWith('more', 'book', undefined);
    const tg = screen.getByRole('link', { name: 'Написать в Telegram' });
    expect(tg.getAttribute('href')).toBe('https://t.me/kotlarewski');
    fireEvent.click(tg);
    expect(track).toHaveBeenLastCalledWith('more', 'write', undefined);
    expect(document.body.textContent).not.toMatch(/₽|руб/);
  });

  it('trigger карточки доезжает до события', () => {
    renderSheet('crisis');
    fireEvent.click(screen.getByRole('link', { name: 'Записаться на встречу' }));
    expect(track).toHaveBeenLastCalledWith('more', 'book', 'crisis');
  });

  it('«Назад» закрывает через goBack', () => {
    renderSheet();
    fireEvent.click(screen.getByRole('button', { name: 'Назад' }));
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  it('терапевт подключён: «Терапевт рядом» и одна кнопка к нему', () => {
    localStorage.setItem('therapy_contact_url', 'tg://user?id=42');
    localStorage.setItem('therapy_contact_name', 'терапевту');
    renderSheet();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Терапевт рядом');
    const w = screen.getByRole('link', { name: 'Написать терапевту' });
    expect(w.getAttribute('href')).toBe('tg://user?id=42');
    fireEvent.click(w);
    expect(track).toHaveBeenLastCalledWith('more', 'write', undefined);
    expect(screen.queryByRole('link', { name: 'Записаться на встречу' })).toBeNull();
  });
});
