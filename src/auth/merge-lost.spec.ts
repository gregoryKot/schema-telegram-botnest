// Что удалится при слиянии без объединения: строки источника, чей уникальный
// ключ уже есть у цели (DELETE…EXISTS из UNIQUE_RULES). Живая база —
// test/merge-unique-rules.e2e-spec.ts (summarize до merge).
import { Logger } from '@nestjs/common';
import { COMBINE_TABLES } from './merge-combine';
import {
  LOST_ON_CONFLICT,
  LOST_UNSHOWN,
  countLost,
  type LostDb,
} from './merge-lost';
import { UNIQUE_RULES } from './merge.service';

const SRC = 111n;
const TGT = 222n;
const OTHER = 333n;

type Row = Record<string, unknown> & { userId: bigint };
type Where = { userId: { in: bigint[] } };

/** Делегат в памяти: findMany честно фильтрует по where.userId.in. */
function table(rows: Row[]) {
  return {
    findMany: jest.fn(({ where }: { where: Where }) =>
      Promise.resolve(rows.filter((r) => where.userId.in.includes(r.userId))),
    ),
  };
}

function makeDb(seed: Partial<Record<string, Row[]>> = {}) {
  const db = {
    rating: table(seed.rating ?? []),
    childhoodRating: table(seed.childhoodRating ?? []),
    ysqProgress: table(seed.ysqProgress ?? []),
    therapistRequest: table(seed.therapistRequest ?? []),
    note: table(seed.note ?? []),
  };
  return { db, lostDb: db as unknown as LostDb };
}

const rate = (userId: bigint, date: string, needId: string) => ({
  userId,
  date,
  needId,
});

describe('реестр потерь при слиянии (правило №4)', () => {
  // Новая таблица в UNIQUE_RULES обязана получить решение: объединять
  // (COMBINERS), называть потерю на экране (LOST_ON_CONFLICT) или записать в
  // LOST_UNSHOWN, почему молчим. Без решения строка источника пропадёт молча.
  it('COMBINERS, LOST_ON_CONFLICT и LOST_UNSHOWN не пересекаются и вместе = UNIQUE_RULES', () => {
    const groups = [
      COMBINE_TABLES,
      Object.keys(LOST_ON_CONFLICT),
      Object.keys(LOST_UNSHOWN),
    ];
    const all = groups.flat();
    const ruled = UNIQUE_RULES.map((r) => r.table);
    expect({
      overlap: all.filter((t, i) => all.indexOf(t) !== i),
      unclassified: ruled.filter((t) => !all.includes(t)),
      notInRules: all.filter((t) => !ruled.includes(t)),
    }).toEqual({ overlap: [], unclassified: [], notInRules: [] });
  });

  it('у каждой непоказанной таблицы — причина словами', () => {
    for (const reason of Object.values(LOST_UNSHOWN)) {
      expect(reason.length).toBeGreaterThan(20);
    }
  });
});

describe('countLost', () => {
  it('Rating: совпали дата и потребность → 1; совпала только дата → 0', async () => {
    const { lostDb } = makeDb({
      rating: [
        rate(TGT, '2026-03-01', 'safety'),
        rate(SRC, '2026-03-01', 'safety'),
        rate(SRC, '2026-03-01', 'autonomy'),
      ],
    });
    expect(await countLost(lostDb, SRC, TGT)).toEqual({ Rating: 1 });
  });

  it('ChildhoodRating: по потребности', async () => {
    const { lostDb } = makeDb({
      childhoodRating: [
        { userId: TGT, needId: 'safety' },
        { userId: SRC, needId: 'safety' },
        { userId: SRC, needId: 'play' },
      ],
    });
    expect(await countLost(lostDb, SRC, TGT)).toEqual({ ChildhoodRating: 1 });
  });

  it('конфликтов нет → ключей нет', async () => {
    const { lostDb } = makeDb({
      rating: [rate(SRC, '2026-03-01', 'safety')],
      ysqProgress: [{ userId: SRC }],
    });
    expect(await countLost(lostDb, SRC, TGT)).toEqual({});
  });

  it('строки третьего аккаунта не считаются', async () => {
    const { lostDb } = makeDb({
      rating: [
        rate(OTHER, '2026-03-01', 'safety'),
        rate(SRC, '2026-03-01', 'safety'),
      ],
      therapistRequest: [{ userId: OTHER }, { userId: SRC }],
    });
    expect(await countLost(lostDb, SRC, TGT)).toEqual({});
  });

  it('YsqProgress и TherapistRequest: строка у цели есть → 1, нет → 0', async () => {
    const withTarget = makeDb({
      ysqProgress: [{ userId: SRC }, { userId: TGT }],
      therapistRequest: [{ userId: SRC }, { userId: TGT }],
    });
    expect(await countLost(withTarget.lostDb, SRC, TGT)).toEqual({
      YsqProgress: 1,
      TherapistRequest: 1,
    });
    const onlySource = makeDb({
      ysqProgress: [{ userId: SRC }],
      therapistRequest: [{ userId: SRC }],
    });
    expect(await countLost(onlySource.lostDb, SRC, TGT)).toEqual({});
  });

  it('объединяемая таблица (Note) в потерях не появляется', async () => {
    const { db, lostDb } = makeDb({
      note: [
        { userId: TGT, date: '2026-03-01' },
        { userId: SRC, date: '2026-03-01' },
      ],
    });
    const lost = await countLost(lostDb, SRC, TGT);
    expect(lost).not.toHaveProperty('Note');
    expect(db.note.findMany).not.toHaveBeenCalled();
  });

  it('падение одной таблицы — в лог, остальные посчитаны', async () => {
    const error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const { db, lostDb } = makeDb({
      ysqProgress: [{ userId: SRC }, { userId: TGT }],
    });
    db.rating.findMany.mockRejectedValueOnce(new Error('boom'));
    expect(await countLost(lostDb, SRC, TGT)).toEqual({ YsqProgress: 1 });
    expect(error).toHaveBeenCalledWith(expect.stringContaining('Rating'));
    error.mockRestore();
  });
});
