// @vitest-environment jsdom
// api.ts — оставшиеся ручки, не покрытые api.test.ts (тот фокусируется на
// заголовках/ошибках/таймауте общего пути). Здесь — таблично: каждая ручка
// реально шлёт правильный HTTP-метод и URL. Это тот самый класс регрессии,
// что уже случался (см. комментарий вверху api.test.ts): ручка тихо
// переписывается в обход общих get/post/del и теряет таймаут/повтор, либо
// URL в ручке расходится с бэкендом при рефакторинге путей.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { api } from './api';

function mockFetchOnce(body?: unknown) {
  const json = vi.fn().mockResolvedValue(body ?? {});
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: true,
    status: 200,
    json,
  });
}

beforeEach(() => {
  global.fetch = vi.fn();
  (window as unknown as { Telegram?: unknown }).Telegram = {
    WebApp: { initData: 'query_id=AAA&user=%7B%7D&hash=deadbeef' },
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  delete (window as unknown as { Telegram?: unknown }).Telegram;
});

function lastCall() {
  const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
  return { url: url as string, init: init as RequestInit };
}

// ─── GET-ручки: путь и метод ─────────────────────────────────────────────────
const GET_CASES: [string, () => Promise<unknown>, string][] = [
  ['getHealthyPhrase', () => api.getHealthyPhrase(), '/api/healthy-phrase'],
  ['getYsqProgress', () => api.getYsqProgress(), '/api/ysq-progress'],
  ['needs', () => api.needs(), '/api/needs'],
  ['getSettings', () => api.getSettings(), '/api/settings'],
  ['getAchievements', () => api.getAchievements(), '/api/achievements'],
  ['getNote', () => api.getNote('2026-08-03'), '/api/note?date=2026-08-03'],
  ['getInsights', () => api.getInsights(), '/api/insights'],
  ['getExport', () => api.getExport(), '/api/export'],
  ['getJourney', () => api.getJourney(), '/api/journey'],
  [
    'getPractices',
    () => api.getPractices('safety'),
    '/api/practices?needId=safety',
  ],
  ['getPendingPlans', () => api.getPendingPlans(), '/api/plan/pending'],
  ['getPair', () => api.getPair(), '/api/pair'],
  [
    'getChildhoodRatings',
    () => api.getChildhoodRatings(),
    '/api/childhood-ratings',
  ],
  ['getYsqResult', () => api.getYsqResult(), '/api/ysq-result'],
  ['getYsqHistory', () => api.getYsqHistory(), '/api/ysq-history'],
  ['getProfile', () => api.getProfile(), '/api/profile'],
  ['getSchemaDiary', () => api.getSchemaDiary(), '/api/diary/schema'],
  ['getModeDiary', () => api.getModeDiary(), '/api/diary/mode'],
  ['getGratitudeDiary', () => api.getGratitudeDiary(), '/api/diary/gratitude'],
  [
    'getTherapyRelation',
    () => api.getTherapyRelation(),
    '/api/therapy/relation',
  ],
  ['getTherapyClients', () => api.getTherapyClients(), '/api/therapy/clients'],
  [
    'getTherapistRequest',
    () => api.getTherapistRequest(),
    '/api/therapy/request',
  ],
  ['getTasks', () => api.getTasks(), '/api/therapy/tasks'],
  ['getTaskHistory', () => api.getTaskHistory(), '/api/therapy/tasks/history'],
  [
    'getTherapyTasksForClient',
    () => api.getTherapyTasksForClient(9),
    '/api/therapy/tasks/client/9',
  ],
  ['getTherapistNotes', () => api.getTherapistNotes(9), '/api/therapy/notes/9'],
  [
    'getConceptualization',
    () => api.getConceptualization(9),
    '/api/therapy/conceptualization/9',
  ],
  [
    'getTherapyClientData',
    () => api.getTherapyClientData(9),
    '/api/therapy/client-data/9',
  ],
  ['getSchemaNotes', () => api.getSchemaNotes(), '/api/schema-notes'],
  ['getModeNotes', () => api.getModeNotes(), '/api/mode-notes'],
  ['getBeliefChecks', () => api.getBeliefChecks(), '/api/belief-checks'],
  ['getLetters', () => api.getLetters(), '/api/letters'],
  ['getSafePlace', () => api.getSafePlace(), '/api/safe-place'],
  ['getFlashcards', () => api.getFlashcards(), '/api/flashcards'],
  [
    'getClientSchemaNotes',
    () => api.getClientSchemaNotes(9),
    '/api/therapy/client/9/schema-notes',
  ],
  [
    'getClientModeNotes',
    () => api.getClientModeNotes(9),
    '/api/therapy/client/9/mode-notes',
  ],
  [
    'getPracticeSessions',
    () => api.getPracticeSessions(),
    '/api/practice-sessions',
  ],
];

describe('api — GET-ручки шлют верный метод и URL', () => {
  it.each(GET_CASES)('%s → GET %s', async (_name, call, expectedUrl) => {
    mockFetchOnce([]);
    await call();
    const { url, init } = lastCall();
    expect(url).toBe(expectedUrl);
    expect(init.method ?? 'GET').toBe('GET');
  });
});

// ─── POST/POST-JSON-ручки: путь ──────────────────────────────────────────────
const POST_CASES: [string, () => Promise<unknown>, string][] = [
  ['acceptDisclaimer', () => api.acceptDisclaimer(), '/api/disclaimer'],
  [
    'saveYsqProgress',
    () => api.saveYsqProgress([1, 2], 3),
    '/api/ysq-progress',
  ],
  ['addPractice', () => api.addPractice('safety', 'text'), '/api/practices'],
  ['createPlan', () => api.createPlan('safety', 'text', 10), '/api/plan'],
  ['joinPair', () => api.joinPair('CODE'), '/api/pair/join'],
  [
    'saveChildhoodRatings',
    () => api.saveChildhoodRatings({ safety: 5 }),
    '/api/childhood-ratings',
  ],
  ['saveYsqResult', () => api.saveYsqResult([1, 2]), '/api/ysq-result'],
  ['joinTherapy', () => api.joinTherapy('CODE'), '/api/therapy/join'],
  [
    'renameClient',
    () => api.renameClient(9, 'Аня'),
    '/api/therapy/rename-client/9',
  ],
  ['requestYsq', () => api.requestYsq(9), '/api/therapy/request-ysq/9'],
  [
    'updateSessionInfo',
    () => api.updateSessionInfo(9, {}),
    '/api/therapy/session-info/9',
  ],
  [
    'saveSchemaNote',
    () => api.saveSchemaNote({ schemaId: 'x' }),
    '/api/schema-notes',
  ],
  ['saveModeNote', () => api.saveModeNote({ modeId: 'x' }), '/api/mode-notes'],
  [
    'createBeliefCheck',
    () =>
      api.createBeliefCheck({
        belief: 'x',
        evidenceFor: [],
        evidenceAgainst: [],
      }),
    '/api/belief-checks',
  ],
  ['createLetter', () => api.createLetter('text'), '/api/letters'],
  ['saveSafePlace', () => api.saveSafePlace('desc'), '/api/safe-place'],
  [
    'createFlashcard',
    () => api.createFlashcard({ modeId: 'x', needId: 'y' }),
    '/api/flashcards',
  ],
  [
    'completeTask',
    () => api.completeTask(9, true),
    '/api/therapy/tasks/9/complete',
  ],
  [
    'createTherapyInvite',
    () => api.createTherapyInvite(),
    '/api/therapy/invite',
  ],
  [
    'addClientManually',
    () => api.addClientManually(123),
    '/api/therapy/clients/add',
  ],
  [
    'addVirtualClient',
    () => api.addVirtualClient('Имя'),
    '/api/therapy/clients/virtual',
  ],
  [
    'becomeTherapist',
    () => api.becomeTherapist('CODE'),
    '/api/therapy/become-therapist',
  ],
  [
    'submitTherapistRequest',
    () =>
      api.submitTherapistRequest({
        fullName: 'А',
        qualification: 'Психолог',
        contacts: 'a@b.ru',
      }),
    '/api/therapy/request',
  ],
  [
    'setTherapistView',
    () => api.setTherapistView(true),
    '/api/therapy/therapist-view',
  ],
  [
    'createTask',
    () => api.createTask({ type: 'x', text: 'y' }),
    '/api/therapy/tasks',
  ],
  [
    'createTherapistNote',
    () => api.createTherapistNote(9, '2026-08-01', 'note'),
    '/api/therapy/notes/9',
  ],
  [
    'saveConceptualization',
    () => api.saveConceptualization(9, {}),
    '/api/therapy/conceptualization/9',
  ],
  [
    'recordPracticeSession',
    () => api.recordPracticeSession('breathing'),
    '/api/practice-session',
  ],
];

describe('api — POST/POST-JSON-ручки шлют верный метод и URL', () => {
  it.each(POST_CASES)('%s → POST %s', async (_name, call, expectedUrl) => {
    mockFetchOnce({});
    await call();
    const { url, init } = lastCall();
    expect(url).toBe(expectedUrl);
    expect(init.method).toBe('POST');
  });
});

// ─── DELETE-ручки: путь ──────────────────────────────────────────────────────
const DELETE_CASES: [string, () => Promise<unknown>, string][] = [
  ['deleteSchemaDiary', () => api.deleteSchemaDiary(9), '/api/diary/schema/9'],
  ['deleteModeDiary', () => api.deleteModeDiary(9), '/api/diary/mode/9'],
  [
    'deleteGratitudeDiary',
    () => api.deleteGratitudeDiary(9),
    '/api/diary/gratitude/9',
  ],
  [
    'resignTherapist',
    () => api.resignTherapist(),
    '/api/therapy/therapist-role',
  ],
  ['removeClient', () => api.removeClient(9), '/api/therapy/clients/9'],
  [
    'deleteTherapistNote',
    () => api.deleteTherapistNote(9),
    '/api/therapy/notes/9',
  ],
  ['deleteBeliefCheck', () => api.deleteBeliefCheck(9), '/api/belief-checks/9'],
  ['deleteLetter', () => api.deleteLetter(9), '/api/letters/9'],
  ['deleteFlashcard', () => api.deleteFlashcard(9), '/api/flashcards/9'],
];

describe('api — DELETE-ручки шлют верный метод и URL', () => {
  it.each(DELETE_CASES)('%s → DELETE %s', async (_name, call, expectedUrl) => {
    mockFetchOnce({});
    await call();
    const { url, init } = lastCall();
    expect(url).toBe(expectedUrl);
    expect(init.method).toBe('DELETE');
  });
});
