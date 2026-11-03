// @vitest-environment jsdom
// useAddClient — два способа добавить клиента в кабинете терапевта
// (пригласительная ссылка / виртуальный клиент). Read-after-write:
// список клиентов обязан обновиться значением ИЗ ОТВЕТА сервера, а не
// локальной догадкой; ошибки API — видны (не «тихо съедены», правило №4).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAddClient } from './useAddClient';
import type { TherapyClientSummary } from '../../api';

vi.mock('../../api', () => ({
  api: {
    createTherapyInvite: vi.fn(),
    addVirtualClient: vi.fn(),
    getTherapyInvites: vi.fn(() => Promise.resolve([])),
    revokeTherapyInvite: vi.fn(),
  },
}));
import { api } from '../../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

beforeEach(() => {
  vi.clearAllMocks();
});

function setup() {
  const setClients = vi.fn();
  const { result } = renderHook(() => useAddClient({ setClients }));
  return { result, setClients };
}

describe('useAddClient — приглашение по ссылке', () => {
  it('createInvite кладёт ссылку и код из ответа сервера', async () => {
    mockApi.createTherapyInvite.mockResolvedValue({
      url: 'https://t.me/xyz',
      code: '7F3A9C21B04E',
    });
    const { result } = setup();
    await act(() => result.current.createInvite());
    expect(result.current.invite).toEqual({
      url: 'https://t.me/xyz',
      code: '7F3A9C21B04E',
    });
    expect(result.current.inviteLoading).toBe(false);
  });

  // Инцидент 2026-10-26: имя едет в приглашении — после подключения одна
  // карточка с этим именем, до него — строка в «Ждут подключения».
  it('имя из поля уходит в приглашение, поле очищается, список ждущих перечитан', async () => {
    mockApi.createTherapyInvite.mockResolvedValue({ url: 'u', code: 'c' });
    const { result } = setup();
    await act(async () => {}); // первая загрузка списка ждущих
    act(() => result.current.setAddInput('  Мария К. '));
    await act(() => result.current.createInvite());
    expect(mockApi.createTherapyInvite).toHaveBeenCalledWith('Мария К.');
    expect(result.current.addInput).toBe('');
    expect(mockApi.getTherapyInvites).toHaveBeenCalledTimes(2);
  });

  it('без имени — приглашение без имени', async () => {
    mockApi.createTherapyInvite.mockResolvedValue({ url: 'u', code: 'c' });
    const { result } = setup();
    await act(() => result.current.createInvite());
    expect(mockApi.createTherapyInvite).toHaveBeenCalledWith(undefined);
  });

  it('createInvite упал — ошибка видна, а не тихо проглочена', async () => {
    mockApi.createTherapyInvite.mockRejectedValue(new Error('network'));
    const { result } = setup();
    await act(() => result.current.createInvite());
    expect(result.current.addError).toMatch(/Не удалось создать приглашение/);
    expect(result.current.invite).toBeNull();
  });

  it('предел живых приглашений — текст с выходом', async () => {
    mockApi.createTherapyInvite.mockRejectedValue({
      status: 409,
      reason: 'too_many_invites',
    });
    const { result } = setup();
    await act(() => result.current.createInvite());
    expect(result.current.addError).toMatch(/Отзови ненужные/);
  });
});

describe('useAddClient — виртуальный клиент', () => {
  it('пустое имя — ошибка, запрос не уходит', async () => {
    const { result } = setup();
    act(() => result.current.setAddInput('   '));
    await act(() => result.current.addVirtualClient());
    expect(result.current.addError).toMatch(/имя/);
    expect(mockApi.addVirtualClient).not.toHaveBeenCalled();
  });

  it('успех — список клиентов обновлён из ответа, поле очищается через openAddMode(null)', async () => {
    const updated = [{ telegramId: -1, name: 'Виртуальный' }];
    mockApi.addVirtualClient.mockResolvedValue(updated);
    const { result, setClients } = setup();
    act(() => result.current.setAddInput('Виртуальный'));
    await act(() => result.current.addVirtualClient());
    expect(setClients).toHaveBeenCalledWith(updated);
    expect(result.current.addMode).toBeNull();
    expect(result.current.addInput).toBe('');
  });
});

describe('useAddClient — copyInvite', () => {
  it('без приглашения ничего не делает', async () => {
    const writeText = vi.fn();
    Object.assign(navigator, { clipboard: { writeText } });
    const { result } = setup();
    await act(() => result.current.copyInvite());
    expect(writeText).not.toHaveBeenCalled();
  });

  it('копирует ссылку и на 2с показывает inviteCopied', async () => {
    vi.useFakeTimers();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    mockApi.createTherapyInvite.mockResolvedValue({
      url: 'https://t.me/abc',
      code: 'c',
    });
    const { result } = setup();
    await act(() => result.current.createInvite());
    await act(() => result.current.copyInvite());
    expect(writeText).toHaveBeenCalledWith('https://t.me/abc');
    expect(result.current.inviteCopied).toBe(true);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.inviteCopied).toBe(false);
    vi.useRealTimers();
  });
});

// QA 2026-11 (пара — webapp/useAddClient.test.ts): двойной Enter или тап,
// пока запрос в полёте, создавал второго клиента / второе приглашение.
describe('useAddClient — повтор, пока запрос в полёте', () => {
  it('два «Создать» офлайн-клиента в одном кадре — один запрос', async () => {
    let resolve!: (v: TherapyClientSummary[]) => void;
    mockApi.addVirtualClient.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const { result, setClients } = setup();
    act(() => result.current.setAddInput('Анна К.'));
    let first!: Promise<unknown>;
    act(() => {
      first = result.current.addVirtualClient();
      void result.current.addVirtualClient();
    });
    await act(async () => {
      resolve([]);
      await first;
    });
    expect(mockApi.addVirtualClient).toHaveBeenCalledTimes(1);
    expect(setClients).toHaveBeenCalledTimes(1);
  });

  it('два «Создать приглашение» в одном кадре — одно приглашение', async () => {
    let resolve!: (v: { url: string; code: string }) => void;
    mockApi.createTherapyInvite.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const { result } = setup();
    let first!: Promise<unknown>;
    act(() => {
      first = result.current.createInvite();
      void result.current.createInvite();
    });
    await act(async () => {
      resolve({ url: 'https://t.me/x', code: 'c' });
      await first;
    });
    expect(mockApi.createTherapyInvite).toHaveBeenCalledTimes(1);
  });
});
