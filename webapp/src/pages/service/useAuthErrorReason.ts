// Причина экрана `/auth/error` из адреса → известный код + один отчёт наверх
// (К2, аудит 2026-08: экран-тупик обязан доложить о сбое входа). В отчёт —
// только код из словаря или `unknown` (S20, аудит 2026-11): адрес собирает
// кто угодно, и чужой текст не должен доезжать ни до экрана, ни до админа.
import { getHost } from '../../../../shared/src/host';
import { useAuthFailureReport } from '../../../../shared/src/host/authFailureReport';
import { reportClientError } from '../../api';
import { knownAuthErrorReason, reportedAuthErrorReason } from './authErrorReasons';

export function useAuthErrorReason(search: string): string | null {
  const raw = new URLSearchParams(search).get('reason');
  const reported = reportedAuthErrorReason(raw);
  useAuthFailureReport(
    reportClientError,
    reported
      ? {
          hostId: getHost().id,
          signaturePresent:
            ((getHost().sessionExchange()?.body.initData as string) ?? '') !== '',
          error: reported,
        }
      : null,
  );
  return knownAuthErrorReason(raw);
}
