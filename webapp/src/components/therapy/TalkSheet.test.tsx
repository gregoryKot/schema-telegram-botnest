// @vitest-environment jsdom
// Лист «Поговорить с кем-то»: кнопки шлют события с местом, «Назад» закрывает, цены нет.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
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
  // Владелец 2026-11-08: без «автора приложения» — от первого лица, главное действие «Написать мне».
  it('терапевт не подключён: «напиши мне» от первого лица, Telegram первым, запись с меткой места, цены нет', () => {
    renderSheet();
    expect(screen.getByText('Поговорить с кем-то', { selector: '.ds-eyebrow' })).toBeTruthy();
    expect(screen.getByText(/Если хочешь в терапию, напиши мне\./)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/[Аа]втор/);
    const links = screen.getAllByRole('link');
    expect(links.map(l => l.textContent)).toEqual(['Написать мне', 'Выбрать время на сайте']);
    const tg = screen.getByRole('link', { name: 'Написать мне' });
    expect(tg.getAttribute('href')).toBe('https://t.me/kotlarewski');
    fireEvent.click(tg);
    expect(track).toHaveBeenLastCalledWith('more', 'write', undefined);
    const book = screen.getByRole('link', { name: 'Выбрать время на сайте' });
    expect(book.getAttribute('href')).toBe('https://kotlarewski.gr/?from=app_more#booking');
    fireEvent.click(book);
    expect(track).toHaveBeenLastCalledWith('more', 'book', undefined);
    expect(document.body.textContent).not.toMatch(/₽|руб/);
  });

  it('trigger карточки доезжает до события', () => {
    renderSheet('crisis');
    fireEvent.click(screen.getByRole('link', { name: 'Выбрать время на сайте' }));
    expect(track).toHaveBeenLastCalledWith('more', 'book', 'crisis');
  });

  // QA 2026-11: фокус оставался на строке «Ещё» под листом, Tab ходил по невидимой странице.
  it('забирает фокус на «Назад», держит Tab внутри и возвращает фокус вызвавшей строке', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const { unmount } = renderSheet();
    const back = screen.getByRole('button', { name: 'Назад' });
    expect(document.activeElement).toBe(back);
    screen.getAllByRole('link').at(-1)!.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(back);
    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
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
    expect(screen.queryByRole('link', { name: 'Выбрать время на сайте' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Написать мне' })).toBeNull();
  });

  // Аудит 2026-11, U4: у терапевта без Telegram ссылка пустая — лист обещал
  // «написать прямо сейчас» и не давал ни одной кнопки.
  it('терапевт без канала связи: «запиши и принеси на встречу» и действие — к ближайшей встрече', () => {
    localStorage.setItem('therapy_contact_url', '');
    localStorage.setItem('therapy_contact_name', 'терапевту');
    const Where = () => <div data-testid="where">{useLocation().pathname}</div>;
    render(<MemoryRouter initialEntries={['/more']}><TalkSheet place="more" onClose={vi.fn()} /><Where /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Терапевт рядом');
    expect(document.body.textContent).not.toMatch(/написать прямо сейчас/);
    expect(screen.getByText(/Запиши, что всплыло, и принеси на встречу/)).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Написать терапевту' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ближайшая встреча' }));
    expect(track).toHaveBeenLastCalledWith('more', 'session', undefined);
    // Лист сперва снимает свою запись истории, потом ведёт в профиль (карточка терапевта).
    const then = goBack.mock.calls.at(-1)?.[0] as () => void;
    act(() => then());
    expect(screen.getByTestId('where').textContent).toBe('/profile');
  });
});
