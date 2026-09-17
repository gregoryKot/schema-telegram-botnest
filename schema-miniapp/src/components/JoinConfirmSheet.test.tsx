// @vitest-environment jsdom
// JoinConfirmSheet (M1, аудит 2026-08): экран-согласие перед присоединением по
// startParam (?startapp=pair_/therapy_). Ключевой инвариант безопасности —
// БЕЗ явного «Присоединиться» api.join* не вызывается (fail-closed), закрытие =
// отказ. Плюс: подтверждение пары джойнит и рефрешит пару; ошибка джойна видна,
// а не молчит; форма ты/вы разведена в объяснении объёма расшаривания.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { JoinConfirmSheet } from './JoinConfirmSheet';
import { AddressFormContext } from '../utils/addressForm';
import type { PairsData } from '../api';

vi.mock('../api', () => ({
  api: { joinPair: vi.fn(), joinTherapy: vi.fn(), getPair: vi.fn() },
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const PAIR = { partners: [], pendingCode: null } as unknown as PairsData;

beforeEach(() => {
  vi.clearAllMocks();
  mockApi.getPair.mockResolvedValue(PAIR);
  mockApi.joinPair.mockResolvedValue(undefined);
  mockApi.joinTherapy.mockResolvedValue(undefined);
});
afterEach(cleanup);

const noop = () => {};

describe('JoinConfirmSheet — согласие перед присоединением (fail-closed)', () => {
  it('на маунте НЕ джойнит — ждёт явного подтверждения', () => {
    render(
      <JoinConfirmSheet
        joinKind="pair"
        joinCode="ABC"
        onClose={noop}
        onPairJoined={noop}
      />,
    );
    expect(screen.getByText('Присоединиться к паре?')).toBeTruthy();
    expect(mockApi.joinPair).not.toHaveBeenCalled();
  });

  it('«Не сейчас» закрывает без вызова api.joinPair (отказ = fail-closed)', () => {
    const onClose = vi.fn();
    render(
      <JoinConfirmSheet
        joinKind="pair"
        joinCode="ABC"
        onClose={onClose}
        onPairJoined={noop}
      />,
    );
    fireEvent.click(screen.getByText('Не сейчас'));
    expect(mockApi.joinPair).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('«Присоединиться» (пара) джойнит кодом из ссылки, рефрешит пару и закрывает', async () => {
    const onClose = vi.fn();
    const onPairJoined = vi.fn();
    render(
      <JoinConfirmSheet
        joinKind="pair"
        joinCode="ABC"
        onClose={onClose}
        onPairJoined={onPairJoined}
      />,
    );
    fireEvent.click(screen.getByText('Присоединиться'));
    await waitFor(() => expect(mockApi.joinPair).toHaveBeenCalledWith('ABC'));
    await waitFor(() => expect(onPairJoined).toHaveBeenCalledWith(PAIR));
    expect(onClose).toHaveBeenCalled();
  });

  it('«Присоединиться» (терапия) джойнит кодом и закрывает, getPair не трогает', async () => {
    const onClose = vi.fn();
    render(
      <JoinConfirmSheet
        joinKind="therapy"
        joinCode="XYZ"
        onClose={onClose}
        onPairJoined={noop}
      />,
    );
    fireEvent.click(screen.getByText('Присоединиться'));
    await waitFor(() =>
      expect(mockApi.joinTherapy).toHaveBeenCalledWith('XYZ'),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mockApi.getPair).not.toHaveBeenCalled();
  });

  it('ошибка джойна видна и НЕ закрывает (правило «ошибка API видна»)', async () => {
    const onClose = vi.fn();
    mockApi.joinPair.mockRejectedValue(new Error('bad code'));
    render(
      <JoinConfirmSheet
        joinKind="pair"
        joinCode="BAD"
        onClose={onClose}
        onPairJoined={noop}
      />,
    );
    fireEvent.click(screen.getByText('Присоединиться'));
    await waitFor(() =>
      expect(screen.getByText(/Не получилось присоединиться/)).toBeTruthy(),
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it('форма «вы» звучит в объяснении объёма расшаривания (ты/вы разведены)', () => {
    render(
      <AddressFormContext.Provider value={{ form: 'vy', setForm: noop }}>
        <JoinConfirmSheet
          joinKind="pair"
          joinCode="ABC"
          onClose={noop}
          onPairJoined={noop}
        />
      </AddressFormContext.Provider>,
    );
    expect(screen.getByText(/Партнёр увидит ваш индекс дня/)).toBeTruthy();
  });
});
