// @vitest-environment jsdom
// Блок «Ждут подключения» (инцидент 2026-10-26): приглашённый из «Новый
// клиент» виден до подключения под именем, которое ввёл терапевт; отзыв —
// только после подтверждения в строке.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PendingInvitesList } from './PendingInvitesList';
import { inviteExpiryLabel } from './PendingInviteRow';
import type { PendingInvites, TherapyInvite } from './therapyInvites';

afterEach(() => cleanup());

const maria: TherapyInvite = {
  id: 5,
  code: '7F3A9C21B04E',
  url: 'https://t.me/x/diary?startapp=therapy_7F3A9C21B04E',
  alias: 'Мария К.',
  createdAt: '2026-10-26T10:00:00.000Z',
  expiresAt: '2026-11-02T10:00:00.000Z',
};

function pending(invites: TherapyInvite[] | null | undefined): PendingInvites {
  return {
    invites,
    reload: vi.fn(),
    revoke: vi.fn().mockResolvedValue(undefined),
    revokeFailed: null,
  };
}

describe('PendingInvitesList', () => {
  it('грузится или пусто — блока нет', () => {
    const { container, rerender } = render(
      <PendingInvitesList pending={pending(undefined)} />,
    );
    expect(container.textContent).toBe('');
    rerender(<PendingInvitesList pending={pending([])} />);
    expect(container.textContent).toBe('');
  });

  it('сбой загрузки — ошибка, а не тишина', () => {
    render(<PendingInvitesList pending={pending(null)} />);
    expect(screen.getByRole('alert').textContent).toMatch(
      /Не удалось загрузить приглашения/,
    );
  });

  it('приглашение видно с именем, кодом и сроком', () => {
    render(<PendingInvitesList pending={pending([maria])} />);
    expect(screen.getByText('Ждут подключения · 1')).toBeTruthy();
    expect(screen.getByText('Мария К.')).toBeTruthy();
    expect(screen.getByText('7F3A9C21B04E')).toBeTruthy();
  });

  it('без имени — «Приглашение без имени», а не пустая строка', () => {
    render(
      <PendingInvitesList pending={pending([{ ...maria, alias: null }])} />,
    );
    expect(screen.getByText('Приглашение без имени')).toBeTruthy();
  });

  it('«Отозвать» сначала спрашивает; «Оставить» — без отзыва; подтверждение — отзыв этого id', () => {
    const p = pending([maria]);
    render(<PendingInvitesList pending={p} />);
    fireEvent.click(screen.getByText('Отозвать'));
    expect(p.revoke).not.toHaveBeenCalled();
    expect(screen.getByText('Код перестанет действовать.')).toBeTruthy();
    fireEvent.click(screen.getByText('Оставить'));
    expect(p.revoke).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Отозвать'));
    fireEvent.click(screen.getByText('Отозвать'));
    expect(p.revoke).toHaveBeenCalledWith(5);
  });

  it('отзыв не прошёл — ошибка у этой строки', () => {
    render(
      <PendingInvitesList pending={{ ...pending([maria]), revokeFailed: 5 }} />,
    );
    expect(screen.getByRole('alert').textContent).toMatch(
      /Не удалось отозвать/,
    );
  });
});

describe('inviteExpiryLabel', () => {
  it('день окончания словами', () => {
    expect(inviteExpiryLabel('2026-11-02T10:00:00.000Z')).toMatch(
      /^действует до \d{1,2} ноября$/,
    );
  });
});
