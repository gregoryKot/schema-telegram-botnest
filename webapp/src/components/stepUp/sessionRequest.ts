import { stepUpHeader } from '../../../../shared/src/auth/stepUp';
import { API_BASE } from '../../utils/apiBase';
import type { StepUpSend } from './stepUpContext';

/**
 * POST к ручке аккаунта: сессия этого браузера (Bearer + кука), CSRF-заголовок
 * и код 2FA, когда сервер его попросил (`useStepUpFetch`).
 */
export function sessionPost(path: string, token: string | null, body?: unknown): StepUpSend {
  return (code) =>
    fetch(`${API_BASE}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'x-requested-with': 'webapp',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...stepUpHeader(code),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
}
