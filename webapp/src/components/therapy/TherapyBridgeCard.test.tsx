// @vitest-environment jsdom
// Постоянная карточка моста: без терапевта / подключён терапевт / сам терапевт / «Скрыть».
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TherapyBridgeCard } from './TherapyBridgeCard';

const track = vi.hoisted(() => vi.fn());
vi.mock('./trackTherapyNudge', () => ({ trackTherapyNudge: track }));

const renderCard = () => render(<MemoryRouter><TherapyBridgeCard place="practice" /></MemoryRouter>);

beforeEach(() => { localStorage.clear(); track.mockClear(); });
afterEach(cleanup);

describe('TherapyBridgeCard', () => {
  it('без своего терапевта: спокойный заголовок и кнопка, без подписи про автора; кнопка открывает лист', () => {
    renderCard();
    expect(screen.getByText('Терапия')).toBeTruthy();
    expect(screen.getByText(/Разобраться глубже — на встречах с терапевтом/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/[Аа]втор/);
    expect(screen.queryByRole('button', { name: 'Не сейчас' })).toBeNull();
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('practice', 'shown');
    fireEvent.click(screen.getByRole('button', { name: 'Поговорить с кем-то' }));
    expect(track).toHaveBeenLastCalledWith('practice', 'open', undefined);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('терапевт подключён: ссылка на него и своя подпись', () => {
    localStorage.setItem('therapy_contact_url', 'tg://user?id=42');
    localStorage.setItem('therapy_contact_name', 'терапевту');
    renderCard();
    expect(screen.getByText('Терапевт рядом — это как раз повод написать.')).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Написать терапевту' });
    fireEvent.click(link);
    expect(track).toHaveBeenLastCalledWith('practice', 'write', undefined);
  });

  it('«Скрыть»: карточки нет ни сейчас, ни при следующем показе; событие dismiss', () => {
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Скрыть' }));
    expect(track).toHaveBeenLastCalledWith('practice', 'dismiss');
    expect(screen.queryByText('Терапия')).toBeNull();
    cleanup();
    track.mockClear();
    const { container } = renderCard();
    expect(container.textContent).toBe('');
    expect(track).not.toHaveBeenCalled();
  });

  it('пользователь сам терапевт: пусто, событий нет', () => {
    localStorage.setItem('therapy_contact_url', 'tg://user?id=1');
    localStorage.setItem('therapy_contact_name', 'вам');
    localStorage.setItem('therapy_is_therapist', '1');
    const { container } = renderCard();
    expect(container.textContent).toBe('');
    expect(track).not.toHaveBeenCalled();
  });
});
