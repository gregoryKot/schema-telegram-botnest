// Ответ записи = чтение той же записи — с НАСТОЯЩИМ ключом шифрования
// (инцидент 2026-10-26, docs/INCIDENTS.md). POST /api/diary/schema отдавал
// schemaIds шифротекстом, POST /api/diary/mode — modeId: create расшифровывал
// поля списком вручную, а не той функцией, что GET. Сайт клал ответ в список
// записей, и раздел падал на `schemaIds.map`. Спеки сервисов этого не видели:
// без ENCRYPTION_KEY encrypt() — passthrough, и «шифротекст» в ответе ничем
// не отличался от текста (diary.service.spec.ts даже закреплял строку в
// schemaIds как «находку»). Та же дыра была у belief-checks, practices и
// карточек схем/режимов — фронты их ответ просто не читали.
//
// Механизм:
// 1. Каждая модель с шифрованным полем (реестр FIELD_POLICY) классифицирована
//    здесь: сверка ответа записи (CASES) либо причина, почему ручка не отдаёт
//    строку (NO_ROW_RESPONSE). Новая модель без решения роняет тест.
// 2. Каждый случай пишет запись с ключом и сверяет ответ с GET той же записи;
//    в ответе не должно быть ни одной строки, которая расшифровывается ключом.
import { loadWithKeys } from '../test-support/load-with-keys';
import {
  createFakeTable,
  createFakeTransaction,
  type Row,
} from '../test-support/fake-prisma.spec-helper';
import { FIELD_POLICY } from './encryption-policy';

/* eslint-disable @typescript-eslint/no-require-imports */
const mods = loadWithKeys({ key: 'c4'.repeat(32) }, () => ({
  crypto: require('./crypto') as typeof import('./crypto'),
  diary:
    require('../bot/diary.service') as typeof import('../bot/diary.service'),
  notes:
    require('../bot/notes.service') as typeof import('../bot/notes.service'),
  exercises:
    require('../bot/exercises.service') as typeof import('../bot/exercises.service'),
  practices:
    require('../bot/practices.service') as typeof import('../bot/practices.service'),
  phrase:
    require('../bot/phrase-check.service') as typeof import('../bot/phrase-check.service'),
  therapyNotes:
    require('../therapy/therapy-notes.service') as typeof import('../therapy/therapy-notes.service'),
  modeMaps:
    require('../therapy/mode-maps.service') as typeof import('../therapy/mode-maps.service'),
  tasks:
    require('../therapy/therapy-tasks.service') as typeof import('../therapy/therapy-tasks.service'),
}));
/* eslint-enable @typescript-eslint/no-require-imports */

const USER = 7n;
const THERAPIST = 9n;

function makeServices() {
  const table = (extra: Row = {}) =>
    createFakeTable([], {
      defaults: () => ({
        createdAt: new Date(),
        updatedAt: new Date(),
        ...extra,
      }),
    });
  const prisma: Record<string, unknown> = {
    schemaDiaryEntry: table(),
    modeDiaryEntry: table(),
    gratitudeDiaryEntry: table(),
    userSchemaNote: table(),
    userModeNote: table(),
    user: createFakeTable([{ id: USER, mySchemaIds: null, myModeIds: null }]),
    userBeliefCheck: table(),
    userLetter: table(),
    userSafePlace: table(),
    userFlashcard: table(),
    userPractice: table(),
    practicePlan: table({ done: null }),
    userPhraseCheck: table({ inWarmWords: false }),
    therapistNote: table(),
    modeMap: table({ nodes: [], edges: [] }),
    therapistCustomMode: table(),
    clientConceptualization: table(),
    userTask: table(),
  };
  prisma.$transaction = createFakeTransaction(prisma);
  const db = prisma as never;
  const relations = { assertHasClient: async () => undefined } as never;
  return {
    diary: new mods.diary.DiaryService(db),
    notes: new mods.notes.NotesService(db),
    exercises: new mods.exercises.ExercisesService(db),
    practices: new mods.practices.PracticesService(db),
    phrase: new mods.phrase.PhraseCheckService(db),
    therapyNotes: new mods.therapyNotes.TherapyNotesService(db, relations),
    modeMaps: new mods.modeMaps.ModeMapsService(db, relations),
    tasks: new mods.tasks.TherapyTasksService(db, {} as never),
  };
}
type Services = ReturnType<typeof makeServices>;
type Written = { id?: number };

const byId =
  (w: Written) =>
  <T extends { id: number }>(rows: T[]) =>
    rows.find((r) => r.id === w.id);

interface Case {
  model: string;
  route: string;
  write: (s: Services) => Promise<unknown>;
  /** GET той же записи; нет — ответ по построению не строка GET, проверяется только на шифротекст. */
  read?: (s: Services, w: Written) => Promise<unknown>;
}

const NOTE_TEXT = {
  triggers: 'критика на работе',
  feelings: 'стыд',
  thoughts: 'со мной что-то не так',
  origins: 'детство',
  healthyView: 'ошибка — не приговор',
  behavior: 'замираю',
};

const CASES: Case[] = [
  {
    model: 'SchemaDiaryEntry',
    route: 'POST /api/diary/schema',
    write: (s) =>
      s.diary.createSchemaDiaryEntry(USER, {
        trigger: 'начальник повысил голос',
        emotions: [{ id: 'fear', intensity: 4 }],
        thoughts: 'опять всё испорчено',
        bodyFeelings: 'ком в горле',
        actualBehavior: 'промолчать',
        schemaIds: ['abandonment', 'defectiveness'],
        schemaOrigin: 'крик дома',
        healthyView: 'это его тон, не моя ценность',
        realProblems: 'сроки',
        excessiveReactions: 'паника',
        healthyBehavior: 'спокойно уточнить задачу',
      }),
    read: (s, w) => s.diary.getSchemaDiaryEntries(USER).then(byId(w)),
  },
  {
    model: 'ModeDiaryEntry',
    route: 'POST /api/diary/mode',
    write: (s) =>
      s.diary.createModeDiaryEntry(USER, {
        modeId: 'vulnerable_child',
        situation: 'не ответили на сообщение',
        thoughts: 'никому не нужно',
        feelings: 'одиночество',
        bodyFeelings: 'холод',
        actions: 'листать ленту',
        actualNeed: 'связь',
        childhoodMemories: 'пустая квартира',
        healthyResponse: 'написать другу',
      }),
    read: (s, w) => s.diary.getModeDiaryEntries(USER).then(byId(w)),
  },
  {
    model: 'GratitudeDiaryEntry',
    route: 'POST /api/diary/gratitude (новый день и правка дня)',
    write: async (s) => {
      await s.diary.upsertGratitudeDiaryEntry(USER, '2026-10-27', ['утро']);
      return s.diary.upsertGratitudeDiaryEntry(USER, '2026-10-27', [
        'утро',
        'чай',
      ]);
    },
    read: (s, w) => s.diary.getGratitudeDiaryEntries(USER).then(byId(w)),
  },
  {
    model: 'UserSchemaNote',
    route: 'POST /api/schema-notes',
    write: (s) =>
      s.notes.upsertSchemaNote(USER, 'abandonment', {
        ...NOTE_TEXT,
        reality: 'уходят не все',
      }),
    read: (s) => s.notes.getSchemaNote(USER, 'abandonment'),
  },
  {
    model: 'UserModeNote',
    route: 'POST /api/mode-notes',
    write: (s) =>
      s.notes.upsertModeNote(USER, 'punitive_critic', {
        ...NOTE_TEXT,
        needs: 'принятие',
        modeFunction: 'защищает от ошибок',
        needsMet: 'частично',
        alias: 'Судья',
        fear: 'стану хуже',
      }),
    read: (s) => s.notes.getModeNote(USER, 'punitive_critic'),
  },
  {
    model: 'UserBeliefCheck',
    route: 'POST /api/belief-checks',
    write: (s) =>
      s.exercises.createBeliefCheck(USER, {
        belief: 'всё порчу',
        evidenceFor: ['опоздание'],
        evidenceAgainst: ['сдан проект'],
        reframe: 'иногда ошибаюсь, как все',
      }),
    read: (s, w) => s.exercises.getBeliefChecks(USER).then(byId(w)),
  },
  {
    model: 'UserLetter',
    route: 'POST /api/letters',
    write: (s) => s.exercises.createLetter(USER, 'Дорогой маленький я'),
    read: (s, w) => s.exercises.getLetters(USER).then(byId(w)),
  },
  {
    model: 'UserSafePlace',
    route: 'POST /api/safe-place',
    write: (s) => s.exercises.upsertSafePlace(USER, 'берег озера'),
    read: (s) => s.exercises.getSafePlace(USER),
  },
  {
    model: 'UserFlashcard',
    route: 'POST /api/flashcards',
    write: (s) =>
      s.exercises.createFlashcard(USER, {
        modeId: 'vulnerable_child',
        needId: 'safety',
        reflection: 'страшно',
        action: 'обнять себя',
      }),
    read: (s, w) => s.exercises.getFlashcards(USER).then(byId(w)),
  },
  {
    model: 'UserPractice',
    route: 'POST /api/practices',
    write: (s) => s.practices.addPractice(USER, 'safety', 'тёплый плед'),
    read: (s, w) => s.practices.getPractices(USER, 'safety').then(byId(w)),
  },
  {
    model: 'PracticePlan',
    route: 'POST /api/plan',
    write: (s) =>
      s.practices.createPlan(USER, 'safety', 'прогулка', '2026-10-27', 9),
    read: (s, w) =>
      s.practices.getPendingPlans(USER, '2026-10-27').then(byId(w)),
  },
  {
    model: 'UserPhraseCheck',
    route: 'POST /api/phrase-checks',
    write: (s) =>
      s.phrase.createPhraseCheck(USER, {
        phrase: 'ты никогда не справишься',
        marks: [],
        rewrite: 'бывает трудно, и это решаемо',
      }),
    read: (s, w) => s.phrase.getPhraseChecks(USER).then(byId(w)),
  },
  {
    model: 'UserPhraseCheck',
    route: 'PATCH /api/phrase-checks/:id',
    write: async (s) => {
      const { id } = await s.phrase.createPhraseCheck(USER, {
        phrase: 'стыдно',
        marks: [],
      });
      return s.phrase.updatePhraseCheck(USER, id, 'можно ошибаться');
    },
  },
  {
    model: 'TherapistNote',
    route: 'POST /api/therapy/notes/:clientId',
    write: (s) =>
      s.therapyNotes.createNote(THERAPIST, USER, {
        date: '2026-10-26',
        text: 'тема стыда',
      }),
    read: (s, w) =>
      s.therapyNotes.getNotes(THERAPIST, USER).then((p) => byId(w)(p.notes)),
  },
  {
    model: 'ClientConceptualization',
    route: 'POST /api/therapy/conceptualization/:clientId',
    write: (s) =>
      s.therapyNotes.saveConceptualization(THERAPIST, USER, {
        schemaIds: ['abandonment'],
        goals: 'меньше избегания',
        modeLinks: [{ modeId: 'punitive_critic', alias: 'Судья' }],
      }),
    read: (s) => s.therapyNotes.getConceptualization(THERAPIST, USER),
  },
  {
    model: 'ModeMap',
    route: 'POST /api/therapy/mode-maps/:clientId',
    write: (s) => s.modeMaps.createModeMap(THERAPIST, USER, 'Карта проблемы'),
    read: (s, w) => s.modeMaps.getModeMap(THERAPIST, w.id!),
  },
  {
    model: 'ModeMap',
    route: 'PATCH /api/therapy/mode-maps/map/:mapId',
    write: async (s) => {
      const { id } = await s.modeMaps.createModeMap(THERAPIST, USER, 'Карта');
      return s.modeMaps.updateModeMap(THERAPIST, id, {
        title: 'Карта личности',
        nodes: [{ id: 'n1', label: 'Судья' }],
      });
    },
    read: (s, w) => s.modeMaps.getModeMap(THERAPIST, w.id!),
  },
  {
    model: 'TherapistCustomMode',
    route: 'POST /api/therapy/custom-modes',
    write: (s) => s.modeMaps.createCustomMode(THERAPIST, { name: 'Ворчун' }),
    read: (s, w) => s.modeMaps.listCustomModes(THERAPIST).then(byId(w)),
  },
  {
    // GET (getTasks) добавляет вычисляемый прогресс — сверять не с чем.
    model: 'UserTask',
    route: 'POST /api/therapy/tasks',
    write: (s) =>
      s.tasks.createTask(USER, {
        type: 'custom',
        text: 'прогулка без телефона',
      }),
  },
];

// Ручка записи этих моделей не отдаёт строку таблицы (причина — где это видно).
const NO_ROW_RESPONSE: Record<string, string> = {
  User: 'PATCH /api/settings отвечает { ok: true } (settings.controller.ts); TOTP — коды, а не строка',
  YsqProgress: 'saveYsqProgress ничего не возвращает (src/bot/ysq.service.ts)',
  YsqResult: 'saveYsqResult ничего не возвращает (src/bot/ysq.service.ts)',
  YsqResultHistory:
    'пишется вместе с YsqResult, ответа-строки нет (src/bot/ysq.service.ts)',
  Note: 'saveNote ничего не возвращает (src/bot/bot.service.ts)',
  DiaryDraft:
    'POST /api/drafts/:type отвечает { ok: true } (src/api/api.controller.ts)',
  TherapistRequest:
    'submit отвечает { id, status } (therapist-request.service.ts)',
  TherapyRelation:
    'renameClient — void; addVirtualClient отдаёт getClients (чтение)',
  ScheduledNotification:
    'внутренняя очередь уведомлений, через API не отдаётся',
  AuthProvider:
    'ручки входа отвечают сессией и статусом, строку провайдера не отдают',
  EmailToken: 'magic-link: ответ { ok }, строка токена наружу не уходит',
  Booking:
    'ответ записи — { id, cancelToken, status, paymentUrl } (booking.checkout.ts)',
  ClientMeeting:
    'ответ — { url, replaced } из входа (src/booking/meeting.service.ts)',
  Donation:
    'ответ create — ссылка оплаты и id (src/donation/donation.service.ts)',
  Subscription:
    'ответ subscribe — { id, cancelToken, paymentUrl } (subscription.service.ts)',
  IntroLead: 'submit отвечает { ok: true } (src/booking/intro-lead.service.ts)',
};

const ENC_MODELS = Object.entries(FIELD_POLICY)
  .filter(([, fields]) => Object.values(fields).some((p) => 'enc' in p))
  .map(([model]) => model);

/** Пути строк ответа, которые расшифровываются ключом, — то есть шифротекст. */
function ciphertextPaths(value: unknown, path = '$'): string[] {
  if (typeof value === 'string')
    return mods.crypto.tryDecrypt(value).ok ? [path] : [];
  if (value === null || typeof value !== 'object' || value instanceof Date)
    return [];
  return Object.entries(value).flatMap(([k, v]) =>
    ciphertextPaths(v, `${path}.${k}`),
  );
}

describe('Ответ записи шифрованных данных ↔ реестр шифрования', () => {
  it('каждая модель с шифрованным полем классифицирована: сверка ответа или причина', () => {
    const covered = new Set([
      ...CASES.map((c) => c.model),
      ...Object.keys(NO_ROW_RESPONSE),
    ]);
    expect(ENC_MODELS.filter((m) => !covered.has(m))).toEqual([]);
  });

  it('реестр без протухших записей и без пустых причин', () => {
    const stale = [
      ...CASES.map((c) => c.model),
      ...Object.keys(NO_ROW_RESPONSE),
    ].filter((m) => !ENC_MODELS.includes(m));
    expect(stale).toEqual([]);
    const vague = Object.entries(NO_ROW_RESPONSE).filter(
      ([, why]) => why.length < 20,
    );
    expect(vague).toEqual([]);
  });
});

describe.each(CASES)('$route ($model)', ({ write, read }) => {
  it('в ответе записи нет шифротекста (ключ настоящий)', async () => {
    const written = await write(makeServices());
    expect(written).toBeTruthy();
    expect(ciphertextPaths(written)).toEqual([]);
  });

  if (read) {
    it('ответ записи совпадает с GET той же записи', async () => {
      const s = makeServices();
      const written = (await write(s)) as Written;
      expect(written).toEqual(await read(s, written));
    });
  }
});
