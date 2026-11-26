// @vitest-environment jsdom
// Разбор ответа merge/preview (S20): на экран — только известная форма; отказ — тупик с отчётом наверх (№14).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../../api', () => ({ reportClientError: vi.fn() }));
import { reportClientError } from '../../api';
import { parseMergePreview, useMergePreview } from './useMergePreview';

describe('parseMergePreview', () => {
  it('известная форма проходит как есть', () => {
    expect(parseMergePreview({ provider: 'vk', otherDisplay: 'Аня', summary: { Rating: 3 }, combined: 2, lost: { Rating: 1 }, twoFactorLost: true }))
      .toEqual({ provider: 'vk', otherDisplay: 'Аня', summary: { Rating: 3 }, combined: 2, lost: { Rating: 1 }, twoFactorLost: true });
  });

  it('в сводке — только положительные числа; пустое имя — null; 2FA — только true', () => {
    expect(parseMergePreview({ provider: 'vk', otherDisplay: '', summary: { Rating: 3, Note: '7', X: -1, Y: Infinity }, twoFactorLost: 'yes' }))
      .toEqual({ provider: 'vk', otherDisplay: null, summary: { Rating: 3 }, combined: 0, lost: {}, twoFactorLost: false });
  });

  it('combined (R3) — только конечное положительное число, иначе 0', () => {
    const base = { provider: 'vk', summary: {} };
    expect(parseMergePreview({ ...base, combined: 3 })?.combined).toBe(3);
    for (const bad of ['3', -1, Infinity, NaN, undefined]) {
      expect(parseMergePreview({ ...base, combined: bad })?.combined).toBe(0);
    }
  });

  it('lost — как summary: только конечные положительные числа; нет поля или не объект — {}', () => {
    const base = { provider: 'vk', summary: {} };
    expect(parseMergePreview({ ...base, lost: { Rating: 2, YsqProgress: '1', X: 0, Y: NaN, Z: Infinity } })?.lost).toEqual({ Rating: 2 });
    for (const bad of [undefined, null, 'Rating', 3]) {
      expect(parseMergePreview({ ...base, lost: bad })?.lost).toEqual({});
    }
  });

  it('чужая форма — null (экран скажет нейтрально)', () => {
    expect(parseMergePreview(null)).toBeNull();
    expect(parseMergePreview({ message: 'Forbidden' })).toBeNull();
    expect(parseMergePreview({ provider: 'vk' })).toBeNull();
  });
});

describe('useMergePreview — отказ шлёт отчёт наверх', () => {
  const fetchMock = vi.fn();
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
  beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('fetch', fetchMock); });
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    ['сеть', () => Promise.reject(new TypeError('Failed to fetch')), 'network'],
    ['чужой токен (403)', () => Promise.resolve(reply(403, { message: 'Forbidden' })), 'HTTP 403'],
    ['чужая форма ответа', () => Promise.resolve(reply(200, { message: 'ok' })), 'parse'],
  ])('%s — failed и ровно один отчёт: статус или тип сбоя, без токена', async (_, respond, detail) => {
    fetchMock.mockImplementation(respond);
    const { result } = renderHook(() => useMergePreview('merge-token', 'tok'));
    await waitFor(() => expect(result.current.kind).toBe('failed'));
    expect(reportClientError).toHaveBeenCalledTimes(1);
    expect(reportClientError).toHaveBeenCalledWith({ message: `merge preview failed: ${detail}`, section: 'account.merge' });
  });

  it('сводка пришла — ok, отчёта нет', async () => {
    fetchMock.mockResolvedValue(reply(200, { provider: 'vk', summary: { Rating: 3 } }));
    const { result } = renderHook(() => useMergePreview('merge-token', 'tok'));
    await waitFor(() => expect(result.current.kind).toBe('ok'));
    expect(reportClientError).not.toHaveBeenCalled();
  });
});
