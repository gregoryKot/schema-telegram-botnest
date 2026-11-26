// @vitest-environment jsdom
// Подключение по коду в «Мой терапевт» (инцидент 2026-10-26): что бы человек
// ни вставил — код целиком уходит на сервер; 409 — свой текст на обеих
// площадках (мини-апп раньше писал «Неверный код»); успех — `joined`.
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTherapyCodeJoin } from './useTherapyCodeJoin';

const REL = {
  role: 'client' as const,
  status: 'active',
  partnerName: 'Анна',
  partnerId: 1,
  code: '7F3A9C21B04E',
  nextSession: null,
};

function makeApi() {
  return {
    joinTherapy: vi.fn().mockResolvedValue(undefined),
    getTherapyRelation: vi.fn().mockResolvedValue(REL),
  };
}

describe('useTherapyCodeJoin', () => {
  it('ввод чистится: строчные, пробелы и ссылка → код', () => {
    const { result } = renderHook(() => useTherapyCodeJoin(makeApi(), vi.fn()));
    act(() => result.current.setCode(' 7f3a 9c21 b04e '));
    expect(result.current.code).toBe('7F3A9C21B04E');
    act(() =>
      result.current.setCode(
        'https://t.me/b/diary?startapp=therapy_7f3a9c21b04e',
      ),
    );
    expect(result.current.code).toBe('7F3A9C21B04E');
  });

  it('пустой код — сеть не зовётся', async () => {
    const api = makeApi();
    const { result } = renderHook(() => useTherapyCodeJoin(api, vi.fn()));
    await act(() => result.current.submit());
    expect(api.joinTherapy).not.toHaveBeenCalled();
  });

  it('успех: join с кодом целиком → связь перечитана → onJoined, joined, поле пустое', async () => {
    const api = makeApi();
    const onJoined = vi.fn();
    const { result } = renderHook(() => useTherapyCodeJoin(api, onJoined));
    act(() => result.current.setCode('7f3a9c21b04e'));
    await act(() => result.current.submit());
    expect(api.joinTherapy).toHaveBeenCalledWith('7F3A9C21B04E');
    expect(onJoined).toHaveBeenCalledWith(REL);
    expect(result.current.joined).toBe(true);
    expect(result.current.code).toBe('');
    expect(result.current.error).toBe('');
  });

  it('409 already_connected — свой текст, а не «код не подошёл»', async () => {
    const api = makeApi();
    api.joinTherapy.mockRejectedValue({
      status: 409,
      reason: 'already_connected',
    });
    const { result } = renderHook(() => useTherapyCodeJoin(api, vi.fn()));
    act(() => result.current.setCode('7F3A9C21B04E'));
    await act(() => result.current.submit());
    expect(result.current.error).toMatch(/уже есть подключение/);
    expect(result.current.joined).toBe(false);
  });

  it('400 — «Код не подошёл» с выходом; правка кода стирает ошибку', async () => {
    const api = makeApi();
    api.joinTherapy.mockRejectedValue({ status: 400 });
    const onJoined = vi.fn();
    const { result } = renderHook(() => useTherapyCodeJoin(api, onJoined));
    act(() => result.current.setCode('7F3A9C21B04E'));
    await act(() => result.current.submit());
    expect(result.current.error).toMatch(/Код не подошёл/);
    expect(result.current.busy).toBe(false);
    expect(onJoined).not.toHaveBeenCalled();
    act(() => result.current.setCode('7F3A9C21B04F'));
    expect(result.current.error).toBe('');
  });

  // QA 2026-11, З1: обрыв сети, 429 и 500 выглядели как «Код не подошёл», и
  // человек шёл просить новый код, хотя старый рабочий.
  it.each([
    ['нет сети', new TypeError('Failed to fetch'), /Нет связи с сервером/],
    [
      'таймаут',
      Object.assign(new Error('x'), { name: 'AbortError' }),
      /Нет связи/,
    ],
    ['429', { status: 429 }, /Слишком много попыток/],
    ['500', { status: 500 }, /Сервер не ответил/],
  ])('%s — своя причина, а не «код не подошёл»', async (_n, err, text) => {
    const api = makeApi();
    api.joinTherapy.mockRejectedValue(err);
    const { result } = renderHook(() => useTherapyCodeJoin(api, vi.fn()));
    act(() => result.current.setCode('7F3A9C21B04E'));
    await act(() => result.current.submit());
    expect(result.current.error).toMatch(text);
    expect(result.current.error).not.toMatch(/Код не подошёл/);
  });

  // QA 2026-11, М6: пустое поле или пробелы — кнопка молчала при нажатии.
  it('canSubmit: пусто или пробелы — нельзя, есть код — можно', () => {
    const { result } = renderHook(() => useTherapyCodeJoin(makeApi(), vi.fn()));
    expect(result.current.canSubmit).toBe(false);
    act(() => result.current.setCode('   '));
    expect(result.current.canSubmit).toBe(false);
    act(() => result.current.setCode('7F3A9C21B04E'));
    expect(result.current.canSubmit).toBe(true);
  });
});
