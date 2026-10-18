// Тонкая обёртка над общим хуком (shared/src/portrait/useAboutMe.ts, правило
// №3): вся логика и тесты живут там; здесь — только api мини-аппа и отчёт
// о сбое через reportClientError.
import { api, reportClientError } from '../../api';
import {
  useAboutMe as useSharedAboutMe,
  type AboutMeState,
} from '../../../../shared/src/portrait/useAboutMe';

export type { AboutMeState };

export function useAboutMe(refreshKey?: number) {
  return useSharedAboutMe(api, {
    refreshKey,
    reportError: (message) =>
      reportClientError({ message, section: 'profile-about' }),
  });
}
