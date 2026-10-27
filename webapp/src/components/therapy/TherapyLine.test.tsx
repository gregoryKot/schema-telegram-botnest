// @vitest-environment jsdom
// Строка «самопомощь, не замена терапии»: три ветки (терапевт сам / подключён / не подключён).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TherapyLine } from './TherapyLine';

const track = vi.hoisted(() => vi.fn());
vi.mock('./trackTherapyNudge', () => ({ trackTherapyNudge: track }));

const TEXT = 'Дневник — самопомощь, не замена терапии.';
const renderLine = () => render(<MemoryRouter><TherapyLine place="diary_done" text={TEXT} /></MemoryRouter>);

beforeEach(() => { localStorage.clear(); track.mockClear(); });
afterEach(cleanup);

describe('TherapyLine', () => {
  it('терапевт не подключён: «Поговорить →» открывает лист, событие open, shown один раз', () => {
    renderLine();
    expect(screen.getByText(/Дневник — самопомощь/)).toBeTruthy();
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('diary_done', 'shown');
    fireEvent.click(screen.getByRole('button', { name: 'Поговорить →' }));
    expect(track).toHaveBeenLastCalledWith('diary_done', 'open', undefined);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Нести это в одиночку не обязательно');
  });

  it('терапевт подключён: ссылка «Написать терапевту →» на его контакт, событие write', () => {
    localStorage.setItem('therapy_contact_url', 'tg://user?id=42');
    localStorage.setItem('therapy_contact_name', 'терапевту');
    renderLine();
    const link = screen.getByRole('link', { name: 'Написать терапевту →' });
    expect(link.getAttribute('href')).toBe('tg://user?id=42');
    fireEvent.click(link);
    expect(track).toHaveBeenLastCalledWith('diary_done', 'write', undefined);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('пользователь сам терапевт: ничего не показываем и не считаем', () => {
    localStorage.setItem('therapy_contact_url', 'tg://user?id=1');
    localStorage.setItem('therapy_contact_name', 'вам');
    localStorage.setItem('therapy_is_therapist', '1');
    const { container } = renderLine();
    expect(container.textContent).toBe('');
    expect(track).not.toHaveBeenCalled();
  });
});
