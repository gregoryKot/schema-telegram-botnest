import { describe, it, expect } from 'vitest';
import { ApiError } from '../apiClient';
import { failureDetail } from './failureDetail';

describe('failureDetail', () => {
  it('ApiError — статус сервера без тела и сообщения (в сообщении может быть чужой текст)', () => {
    expect(failureDetail(new ApiError(503, 'maintenance token=abc'))).toBe('HTTP 503');
  });
  it('обычная ошибка — её текст', () => {
    expect(failureDetail(new TypeError('Failed to fetch'))).toBe('Failed to fetch');
  });
  it('не ошибка — строка', () => {
    expect(failureDetail('boom')).toBe('boom');
    expect(failureDetail(undefined)).toBe('undefined');
  });
});
