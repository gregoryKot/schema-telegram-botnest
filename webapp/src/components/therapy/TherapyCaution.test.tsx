// @vitest-environment jsdom
// Предупреждение на входе в упражнение: три ветки (автор / подключён терапевт / сам терапевт).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TherapyCaution } from './TherapyCaution';

const track = vi.hoisted(() => vi.fn());
vi.mock('./trackTherapyNudge', () => ({ trackTherapyNudge: track }));

const renderCaution = () => render(<MemoryRouter><TherapyCaution place="exercise_start" /></MemoryRouter>);

beforeEach(() => { localStorage.clear(); track.mockClear(); });
afterEach(cleanup);

describe('TherapyCaution', () => {
  it('терапевт не подключён: предупреждение, кнопка открывает лист, shown один раз', () => {
    renderCaution();
    expect(screen.getByText('Это самопомощь, не замена терапии.')).toBeTruthy();
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('exercise_start', 'shown');
    fireEvent.click(screen.getByRole('button', { name: 'Поговорить →' }));
    expect(track).toHaveBeenLastCalledWith('exercise_start', 'open', undefined);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('терапевт подключён: ссылка на него, событие write', () => {
    localStorage.setItem('therapy_contact_url', 'tg://user?id=42');
    localStorage.setItem('therapy_contact_name', 'терапевту');
    renderCaution();
    const link = screen.getByRole('link', { name: 'Написать терапевту →' });
    expect(link.getAttribute('href')).toBe('tg://user?id=42');
    fireEvent.click(link);
    expect(track).toHaveBeenLastCalledWith('exercise_start', 'write', undefined);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('пользователь сам терапевт: пусто, событий нет', () => {
    localStorage.setItem('therapy_contact_url', 'tg://user?id=1');
    localStorage.setItem('therapy_contact_name', 'вам');
    localStorage.setItem('therapy_is_therapist', '1');
    const { container } = renderCaution();
    expect(container.textContent).toBe('');
    expect(track).not.toHaveBeenCalled();
  });
});
