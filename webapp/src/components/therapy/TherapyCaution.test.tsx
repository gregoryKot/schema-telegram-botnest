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

  // Редизайн 2026-11: наклейка — знак Limits у первой фразы, пояснение тише второй строкой и ссылка в
  // конце его текста (текст не убран до решения владельца); ветки «кто ответит» и событие shown —
  // те же, что у полного предупреждения.
  it('compact: знак Limits у фразы, пояснение со ссылкой в конце строки; shown так же', () => {
    render(<MemoryRouter><TherapyCaution place="exercise_start" compact /></MemoryRouter>);
    const note = screen.getByRole('note');
    expect(note.className).toBe('th-caution th-caution--compact');
    expect(note.querySelector('.th-caution-sign')?.getAttribute('aria-hidden')).toBe('true');
    expect(note.querySelector('.th-caution-sign svg.pp-art--nav')).toBeTruthy();
    expect(screen.getByText('Это самопомощь, не замена терапии.').className).toBe('th-caution-lead');
    const body = note.querySelector('.th-caution-body')!;
    expect(body.textContent).toMatch(/^Станет тяжело — остановись, это нормально\..* Поговорить →$/);
    expect(body.lastElementChild).toBe(screen.getByRole('button', { name: 'Поговорить →' }));
    expect(track).toHaveBeenCalledWith('exercise_start', 'shown');
  });

  it('по умолчанию — полное предупреждение с пояснением, без знака', () => {
    const { container } = renderCaution();
    expect(screen.getByRole('note').className).toBe('th-caution');
    expect(container.querySelector('.th-caution-body')).toBeTruthy();
    expect(container.querySelector('.th-caution-sign')).toBeNull();
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
