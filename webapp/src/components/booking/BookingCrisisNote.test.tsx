// @vitest-environment jsdom
// Кризисная карточка формы записи визитки (правило №7): на кризисном тексте — карточка со знаком Heart, как в
// кабинете (b28), на «вы»; на обычном — ничего.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('../../api', () => ({ api: { trackPublicEvent: vi.fn() } }));
import { BookingCrisisNote } from './BookingCrisisNote';

afterEach(cleanup);

describe('BookingCrisisNote', () => {
  it('кризисный текст: карточка с телефоном доверия и знаком Heart', () => {
    const { container } = render(<BookingCrisisNote text="не хочу больше жить" />);
    expect(screen.getAllByText(/8-800-100-49-94/).length).toBeGreaterThan(0);
    expect(container.querySelector('svg.pp-art')).toBeTruthy();
  });

  it('контроль: обычный запрос — карточки нет', () => {
    const { container } = render(<BookingCrisisNote text="тревога на работе" />);
    expect(container.innerHTML).toBe('');
  });
});
