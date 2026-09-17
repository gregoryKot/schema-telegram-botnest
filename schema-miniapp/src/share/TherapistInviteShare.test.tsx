// @vitest-environment jsdom
// TherapistInviteShare — кнопка «Поделиться» приглашением клиенту (0% покрытия).
// Пустой inviteUrl — компонент вообще не рендерится (никакой битой кнопки на
// пустой ссылке); клик открывает карточку приглашения.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { TherapistInviteShare } from './TherapistInviteShare';

vi.mock('../api', () => ({ api: { trackEvent: vi.fn() } }));
// canvas 2D недоступен в jsdom без пакета `canvas` — гасим реальную отрисовку.
vi.mock('../../../shared/src/share/cards/inviteCard', () => ({
  drawInviteCard: vi.fn(),
}));

afterEach(cleanup);

describe('TherapistInviteShare', () => {
  it('пустой inviteUrl — ничего не рендерит', () => {
    const { container } = render(<TherapistInviteShare inviteUrl="" />);
    expect(container.textContent).toBe('');
  });

  it('есть inviteUrl — показывает кнопку «Поделиться»', () => {
    render(<TherapistInviteShare inviteUrl="https://t.me/bot?start=abc" />);
    expect(screen.getByText('Поделиться')).toBeTruthy();
  });

  it('клик открывает карточку приглашения (ShareCardSheet)', () => {
    render(<TherapistInviteShare inviteUrl="https://t.me/bot?start=abc" />);
    expect(screen.queryByText('Картинка уйдёт вместе со ссылкой')).toBeNull();
    fireEvent.click(screen.getByText('Поделиться'));
    expect(screen.getByText('Картинка уйдёт вместе со ссылкой')).toBeTruthy();
  });
});
