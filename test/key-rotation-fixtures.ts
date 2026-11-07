// Минимальные строки для живого спека ротации ключа (key-rotation.e2e-spec.ts):
// по одной на каждую запись TARGETS — только обязательные НЕшифруемые колонки.
// Зашифрованные поля спек дописывает сам по списку TARGETS, чтобы набор полей
// нельзя было рассогласовать со списком руками.
import { RotationTarget } from '../src/cli/rotate-encryption/targets';

export type Row = Record<string, unknown>;

export const USER = 910000000001n;
export const THERAPIST = 910000000002n;
const T0 = new Date('2026-10-14T10:00:00Z');

// имя делегата → обязательные колонки без шифрования
export const BASE_ROWS: Record<string, Row> = {
  note: { userId: USER, date: '2026-10-14' },
  userSchemaNote: { userId: USER, schemaId: 'abandonment' },
  userModeNote: { userId: USER, modeId: 'critic' },
  userBeliefCheck: { userId: USER },
  userPhraseCheck: { userId: USER, marks: [] },
  userLetter: { userId: USER },
  userSafePlace: { userId: USER },
  userFlashcard: { userId: USER, modeId: 'critic', needId: 'safety' },
  userPractice: { userId: USER, needId: 'safety' },
  practicePlan: { userId: USER, needId: 'safety', scheduledDate: '2026-10-15' },
  schemaDiaryEntry: { userId: USER },
  modeDiaryEntry: { userId: USER },
  gratitudeDiaryEntry: { userId: USER, date: '2026-10-14' },
  diaryDraft: { userId: USER, type: 'schema', startedAt: T0 },
  userTask: { userId: USER, type: 'custom' },
  therapistNote: { therapistId: THERAPIST, clientId: USER, date: '2026-10-14' },
  clientConceptualization: { therapistId: THERAPIST, clientId: USER },
  booking: {
    startsAt: T0,
    durationMin: 50,
    cancelToken: 'rot-e2e-booking',
  },
  // Публичная форма знакомства: userId нет, обязательных не-шифруемых колонок нет.
  introLead: {},
  clientMeeting: { clientKey: 'rot-e2e-client' },
  authProvider: { userId: USER, provider: 'rot-e2e', providerId: 'rot-e2e-1' },
  donation: { amount: 100 },
  subscription: { period: 'month', amount: 100, cancelToken: 'rot-e2e-sub' },
  modeMap: { therapistId: THERAPIST, clientId: USER },
  therapistCustomMode: { therapistId: THERAPIST },
  therapistRequest: { userId: USER },
  therapyRelation: { code: 'rot-e2e-code', therapistId: THERAPIST },
  scheduledNotification: { userId: USER, sendAt: T0, type: 'reminder' },
  ysqProgress: { userId: USER, page: 1 },
  ysqResult: { userId: USER },
  ysqResultHistory: { userId: USER },
  emailToken: {
    tokenHash: 'rot-e2e-token',
    purpose: 'login',
    expiresAt: new Date('2036-01-01T00:00:00Z'),
  },
  user: { id: USER },
};

// Условие, находящее ровно seed-строку цели: колонки её ключа из созданной строки.
export function whereOf(t: RotationTarget, created: Row): Row {
  const pk = t.pk === undefined ? ['id'] : [t.pk].flat();
  return Object.fromEntries(pk.map((c) => [c, created[c]]));
}
