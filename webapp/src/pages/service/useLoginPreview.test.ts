// @vitest-environment jsdom
// Сверка входа (login-preview): сбой — failed и ровно один отчёт наверх (№14);
// 404 — ожидаемый исход «код не найден», как и успех, — без отчёта.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../../api', () => ({ reportClientError: vi.fn() }));
import { reportClientError } from '../../api';
import { useLoginPreview } from './useLoginPreview';

const fetchMock = vi.fn();
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const ownSession = () => Promise.resolve('own-token');
const PREVIEW = { deviceLabel: 'iPhone · Safari', createdAt: '2026-11-08T11:02:00.000Z' };

beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => vi.unstubAllGlobals());

describe('useLoginPreview — отчёт наверх', () => {
  it.each([
    ['сервер (500)', () => Promise.resolve(reply(500, {})), 'HTTP 500'],
    ['сеть', () => Promise.reject(new TypeError('Failed to fetch')), 'network'],
    ['чужая форма ответа', () => Promise.resolve(reply(200, { deviceLabel: 'x' })), 'parse'],
  ])('%s — failed и ровно один отчёт без кода билета', async (_, respond, detail) => {
    fetchMock.mockImplementation(respond);
    const { result } = renderHook(() => useLoginPreview('K7M2QX94', ownSession));
    await waitFor(() => expect(result.current.kind).toBe('failed'));
    expect(reportClientError).toHaveBeenCalledTimes(1);
    expect(reportClientError).toHaveBeenCalledWith({ message: `login preview failed: ${detail}`, section: 'login.preview' });
  });

  it('сессии нет — запрос не уходит, failed и отчёт NoSession', async () => {
    const { result } = renderHook(() => useLoginPreview('K7M2QX94', () => Promise.resolve(null)));
    await waitFor(() => expect(result.current.kind).toBe('failed'));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(reportClientError).toHaveBeenCalledWith({ message: 'login preview failed: NoSession', section: 'login.preview' });
  });

  it.each([
    ['404 (код мёртв)', 404, {}, 'notfound'],
    ['успех', 200, PREVIEW, 'ok'],
  ])('%s — без отчёта', async (_, status, body, kind) => {
    fetchMock.mockResolvedValue(reply(status, body));
    const { result } = renderHook(() => useLoginPreview('K7M2QX94', ownSession));
    await waitFor(() => expect(result.current.kind).toBe(kind));
    expect(reportClientError).not.toHaveBeenCalled();
  });
});
