// @vitest-environment jsdom
// useAddClient — три способа добавить клиента в кабинете терапевта
// (пригласительная ссылка / Telegram ID / виртуальный клиент). Read-after-write:
// список клиентов обязан обновиться значением ИЗ ОТВЕТА сервера, а не
// локальной догадкой; ошибки API — видны (не «тихо съедены», правило №4).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAddClient } from './useAddClient';

vi.mock('../../api', () => ({
  api: {
    createTherapyInvite: vi.fn(),
    addClientManually: vi.fn(),
    addVirtualClient: vi.fn(),
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
  it('createInvite кладёт URL из ответа сервера', async () => {
    mockApi.createTherapyInvite.mockResolvedValue({ url: 'https://t.me/xyz' });
    const { result } = setup();
    await act(() => result.current.createInvite());
    expect(result.current.inviteUrl).toBe('https://t.me/xyz');
    expect(result.current.inviteLoading).toBe(false);
  });

  it('createInvite упал — ошибка видна, а не тихо проглочена', async () => {
    mockApi.createTherapyInvite.mockRejectedValue(new Error('network'));
    const { result } = setup();
    await act(() => result.current.createInvite());
    expect(result.current.addError).toBe('Не удалось создать ссылку');
    expect(result.current.inviteUrl).toBe('');
  });
});

describe('useAddClient — добавление по Telegram ID', () => {
  it('пустой/нечисловой ввод — ошибка, запрос не уходит', async () => {
    const { result } = setup();
    act(() => result.current.setAddInput('не число'));
    await act(() => result.current.addByTelegramId());
    expect(result.current.addError).toMatch(/Telegram ID/);
    expect(mockApi.addClientManually).not.toHaveBeenCalled();
  });

  it('успех — setClients получает список ИЗ ОТВЕТА сервера, режим закрывается', async () => {
    const updated = [{ telegramId: 42, name: 'Клиент' }];
    mockApi.addClientManually.mockResolvedValue(updated);
    const { result, setClients } = setup();
    act(() => result.current.setAddInput('42'));
    await act(() => result.current.addByTelegramId());
    expect(setClients).toHaveBeenCalledWith(updated);
    expect(result.current.addMode).toBeNull();
  });

  it('сервер говорит "not found" — понятная человеку ошибка', async () => {
    mockApi.addClientManually.mockRejectedValue(new Error('User not found'));
    const { result } = setup();
    act(() => result.current.setAddInput('42'));
    await act(() => result.current.addByTelegramId());
    expect(result.current.addError).toMatch(/не найден/);
  });

  it('сервер говорит "already" — «клиент уже подключён»', async () => {
    mockApi.addClientManually.mockRejectedValue(new Error('already linked'));
    const { result } = setup();
    act(() => result.current.setAddInput('42'));
    await act(() => result.current.addByTelegramId());
    expect(result.current.addError).toBe('Клиент уже подключён');
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
  it('без inviteUrl ничего не делает', async () => {
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
    mockApi.createTherapyInvite.mockResolvedValue({ url: 'https://t.me/abc' });
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
