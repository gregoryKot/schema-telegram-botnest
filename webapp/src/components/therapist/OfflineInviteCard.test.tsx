// @vitest-environment jsdom
// Карточка «Приложение» офлайн-клиента: приглашение из его карточки, а не
// независимое — после подключения данные переезжают на аккаунт клиента.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../api', () => ({
  api: { getTherapyInvites: vi.fn(), createOfflineClientInvite: vi.fn() },
}));
import { api, type TherapyClientSummary } from '../../api';
import { OfflineInviteCard } from './OfflineInviteCard';

const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;
const CLIENT = { telegramId: -57, name: 'Анна' } as unknown as TherapyClientSummary;
const invite = (attachToId: number | null) => ({
  id: 9, code: 'ABCD1234EF56', url: 'https://t.me/b/d?startapp=therapy_ABCD1234EF56',
  alias: 'Анна', createdAt: '2026-11-01T10:00:00.000Z', expiresAt: '2026-11-08T10:00:00.000Z', attachToId,
});
const renderCard = () => render(<MemoryRouter><OfflineInviteCard selectedClient={CLIENT} /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getTherapyInvites.mockResolvedValue([]);
  mockApi.createOfflineClientInvite.mockResolvedValue({ code: 'ABCD1234EF56', url: 'u' });
});
afterEach(cleanup);

describe('OfflineInviteCard', () => {
  it('без приглашения: объяснение и кнопка; клик создаёт и показывает код', async () => {
    renderCard();
    const btn = await screen.findByText('Пригласить в приложение');
    expect(screen.getByText(/переедут на его аккаунт/)).toBeTruthy();
    // S8: перенос — только после ответа терапевта, не сразу по коду.
    expect(screen.getByText(/кабинет спросит, тот ли/)).toBeTruthy();
    mockApi.getTherapyInvites.mockResolvedValue([invite(57)]);
    fireEvent.click(btn);
    await waitFor(() => expect(screen.getByText('ABCD1234EF56')).toBeTruthy());
    expect(mockApi.createOfflineClientInvite).toHaveBeenCalledWith(-57);
    expect(mockApi.getTherapyInvites).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('Пригласить в приложение')).toBeNull();
  });

  it('живое приглашение этой карточки: статус, ссылка, код, без кнопки', async () => {
    mockApi.getTherapyInvites.mockResolvedValue([invite(57)]);
    renderCard();
    expect(await screen.findByText(/Ждёт подключения/)).toBeTruthy();
    expect(screen.getByText(invite(57).url)).toBeTruthy();
    expect(screen.getByText('ABCD1234EF56')).toBeTruthy();
    expect(screen.queryByText('Пригласить в приложение')).toBeNull();
    expect(screen.getByText(/До ответа записи карточки ему не видны/)).toBeTruthy();
  });

  it('чужое и обычное приглашение не считаются', async () => {
    mockApi.getTherapyInvites.mockResolvedValue([invite(99), invite(null)]);
    renderCard();
    expect(await screen.findByText('Пригласить в приложение')).toBeTruthy();
  });

  it('ошибка создания — role=alert', async () => {
    mockApi.createOfflineClientInvite.mockRejectedValue({ status: 409, reason: 'too_many_invites' });
    renderCard();
    fireEvent.click(await screen.findByText('Пригласить в приложение'));
    expect((await screen.findByRole('alert')).textContent).toMatch(/слишком много/);
  });

  it('два быстрых клика — один запрос', async () => {
    renderCard();
    const btn = await screen.findByText('Пригласить в приложение');
    fireEvent.click(btn);
    fireEvent.click(btn);
    await waitFor(() => expect(mockApi.createOfflineClientInvite).toHaveBeenCalledTimes(1));
  });
});
