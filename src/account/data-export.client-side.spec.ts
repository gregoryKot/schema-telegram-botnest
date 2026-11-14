// Выгрузка клиентской стороны (data-export.client-side.ts): концептуализация
// уходит в файл только показанной клиенту и только видом клиента — что видит в
// «Мой терапевт», то и выгружает; остальное перечислено в withheld.
import { exportClientSide } from './data-export.client-side';
import { SHOWN_EXPORTS } from './export-shown';
import { CLIENT_EXPORT_POLICY } from './export-policy.client';
import { encryptConceptFields } from '../therapy/concept-store';

const SHARED_AT = new Date('2026-11-06T09:00:00Z');

function makePrisma() {
  const concept = {
    id: 1,
    therapistId: 100n,
    clientId: 555n,
    ...encryptConceptFields({
      schemaIds: ['defectiveness'],
      modeIds: [],
      earlyExperience: 'ИСТОКИ',
      goals: 'ЗАДАЧА ТЕРАПИИ',
      modeLinks: [
        {
          modeId: 'punitive_critic',
          origin: 'ИСТОКИ',
          strategy: 'ЗАДАЧА ТЕРАПИИ',
        },
      ],
      schemaLinks: [],
    }),
    history: [{ goals: 'ИСТОРИЯ' }],
    sharedWithClientAt: SHARED_AT,
    updatedAt: SHARED_AT,
  };
  const conceptFindMany = jest.fn(async () => [concept]);
  return {
    conceptFindMany,
    prisma: {
      modeMap: { findMany: jest.fn(async () => []) },
      therapyRelation: { findMany: jest.fn(async () => []) },
      clientConceptualization: { findMany: conceptFindMany },
      therapistNote: {
        findMany: jest.fn(async () => {
          throw new Error('УТЕЧКА: заметки терапевта запрошены');
        }),
      },
    },
  };
}

describe('exportClientSide — концептуализация', () => {
  it('в файл — только показанная клиенту схема и только видом клиента', async () => {
    const { prisma, conceptFindMany } = makePrisma();
    const out = await exportClientSide(prisma, 555n);
    expect(conceptFindMany).toHaveBeenCalledWith({
      where: { clientId: 555n, sharedWithClientAt: { not: null } },
    });
    expect(out.data.ClientConceptualization).toEqual([
      expect.objectContaining({
        schemaIds: ['defectiveness'],
        sharedWithClientAt: SHARED_AT,
      }),
    ]);
    const text = JSON.stringify(
      out.data.ClientConceptualization,
      (_k, v: unknown) => (typeof v === 'bigint' ? String(v) : v),
    );
    for (const secret of ['ИСТОКИ', 'ЗАДАЧА ТЕРАПИИ', 'ИСТОРИЯ', 'therapistId'])
      expect(text).not.toContain(secret);
  });

  it('withheld говорит, что осталось у терапевта, — заметки и концептуализация', async () => {
    const { prisma } = makePrisma();
    const out = await exportClientSide(prisma, 555n);
    expect(out.withheld).toEqual([
      expect.objectContaining({
        table: 'ModeMap, TherapistNote, ClientConceptualization',
      }),
    ]);
    expect(out.withheld[0].reason).toContain('истоки, задачи терапии');
  });

  it('у каждой shown-модели есть вид клиента', () => {
    const shown = Object.entries(CLIENT_EXPORT_POLICY)
      .filter(([, d]) => d.status === 'shown')
      .map(([m]) => m);
    expect(shown.filter((m) => !SHOWN_EXPORTS[m])).toEqual([]);
    expect(
      Object.keys(SHOWN_EXPORTS).filter((m) => !shown.includes(m)),
    ).toEqual([]);
  });
});
