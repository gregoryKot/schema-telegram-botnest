// Счётчик прохождений быстрых практик «Здесь и сейчас» (дыхание/заземление/
// «Стоп») — единственная реализация для обоих фронтендов (правило №3).
// До переноса раздела на сайт оба метода жили только в
// schema-miniapp/src/api.ts, и сайт до этих готовых роутов не доставал
// (осознанный долг в scripts/feature-parity-baseline.json, теперь закрыт).
// Отдельным модулем, а не строками в sharedApi.ts — по образцу ratingApi.ts:
// пара методов одной фичи со своим типом ответа, sharedApi.ts и без них
// упирается в лимит размера файла (правило №10).
import type { ApiTransport } from './sharedApi';
import type { QuickPracticeId } from '../practices/quickPractices';

// Форма ответа выражена через QuickPracticeId — отдельный интерфейс в
// apiTypes.ts не заводим: тот файл потокенно зеркалит api.ts и уже висит
// в jscpd-храповике как клон, каждая новая строка удлиняет дубль.
export const createPracticeSessionsApi = (t: ApiTransport) => ({
  recordPracticeSession: (tool: QuickPracticeId) =>
    t.postJson<{ ok: true; count: number }>('/api/practice-session', { tool }),
  getPracticeSessions: () =>
    t.get<Record<QuickPracticeId, number>>('/api/practice-sessions'),
});
