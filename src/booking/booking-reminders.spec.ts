// Напоминание админу — не больше одного раза (аудит 2026-10, r2-3#3 (а)).
// До починки remindWindow слал DM, потом писал reminder*SentAt: второй прогон,
// прочитавший строку до записи метки, слал дубль. Фейк держит строки в памяти,
// и условный UPDATE работает как в Postgres: 1 строка тому, кто первым
// застал поле пустым, 0 — остальным.
import { Logger } from '@nestjs/common';
import { BookingStatus, SessionType } from '@prisma/client';
import { remindWindow, RemindDeps } from './booking-reminders';

type Row = {
  id: number;
  status: BookingStatus;
  startsAt: Date;
  reminder24SentAt: Date | null;
  reminder2SentAt: Date | null;
  [k: string]: unknown;
};

const FIELD = 'reminder24SentAt' as const;
const SOON = () => Date.now() + 24 * 3_600_000;

function row(over: Partial<Row> = {}): Row {
  return {
    id: 7,
    status: BookingStatus.CONFIRMED,
    startsAt: new Date(Date.now() + 20 * 3_600_000),
    durationMin: 50,
    type: SessionType.SESSION_50,
    clientName: 'Мария',
    clientContact: '@maria',
    message: null,
    meetingUrl: null,
    cancelToken: 'tok',
    reminder24SentAt: null,
    reminder2SentAt: null,
    ...over,
  };
}

/**
 * `readers` — сколько прогонов обязаны прочитать выборку, прежде чем любой из
 * них пойдёт дальше: так оба гарантированно видят строку «ещё не напомнено».
 */
function makeDb(rows: Row[], readers = 1) {
  const table = new Map(rows.map((r) => [r.id, { ...r }]));
  const parked: Array<() => void> = [];
  const findMany = jest.fn(async () => {
    const snapshot = [...table.values()]
      .filter((r) => r.status === BookingStatus.CONFIRMED && !r[FIELD])
      .map((r) => ({ ...r }));
    await new Promise<void>((go) => {
      parked.push(go);
      if (parked.length >= readers) parked.splice(0).forEach((g) => g());
    });
    return snapshot;
  });
  const updateMany = jest.fn(
    async ({ where, data }: { where: Partial<Row>; data: Partial<Row> }) => {
      const r = table.get(where.id as number);
      if (!r || r.status !== where.status || r[FIELD] !== null)
        return { count: 0 };
      Object.assign(r, data);
      return { count: 1 };
    },
  );
  const prisma = { booking: { findMany, updateMany } } as never;
  return { prisma, table, updateMany };
}

function deps(prisma: never, sendAdmin = jest.fn(async () => undefined)) {
  const d: RemindDeps = { prisma, logger: new Logger('test'), sendAdmin };
  return { d, sendAdmin };
}

describe('remindWindow — не больше одного напоминания', () => {
  it('два параллельных прогона прочитали одну строку — уходит одно напоминание', async () => {
    const { prisma, table } = makeDb([row()], 2);
    const { d, sendAdmin } = deps(prisma);

    const sent = await Promise.all([
      remindWindow(d, SOON(), FIELD, 'завтра'),
      remindWindow(d, SOON(), FIELD, 'завтра'),
    ]);

    expect(sendAdmin).toHaveBeenCalledTimes(1);
    expect(sent.sort()).toEqual([0, 1]);
    expect(table.get(7)?.[FIELD]).toBeInstanceOf(Date);
  });

  it('метка ставится ДО отправки: отправка упала — повтор не шлёт второй раз', async () => {
    const { prisma, table } = makeDb([row()]);
    const failing = jest.fn(async () => {
      throw new Error('send failed');
    });
    const { d } = deps(prisma, failing);

    await expect(remindWindow(d, SOON(), FIELD, 'завтра')).rejects.toThrow();
    expect(table.get(7)?.[FIELD]).toBeInstanceOf(Date);

    const { d: again, sendAdmin } = deps(prisma);
    await remindWindow(again, SOON(), FIELD, 'завтра');
    expect(sendAdmin).not.toHaveBeenCalled();
  });

  it('бронь отменили между выборкой и захватом — напоминания нет', async () => {
    const { prisma, table, updateMany } = makeDb([row()]);
    const { d, sendAdmin } = deps(prisma);
    const real = updateMany.getMockImplementation()!;
    updateMany.mockImplementationOnce(async (args) => {
      table.get(7)!.status = BookingStatus.CANCELLED; // отмена успела раньше
      return real(args);
    });

    await expect(remindWindow(d, SOON(), FIELD, 'завтра')).resolves.toBe(0);

    expect(sendAdmin).not.toHaveBeenCalled();
    expect(table.get(7)?.[FIELD]).toBeNull(); // отменённую не метим
  });

  it('контроль: две свежие брони — по напоминанию на каждую, метки стоят', async () => {
    const { prisma, table } = makeDb([row(), row({ id: 8 })]);
    const { d, sendAdmin } = deps(prisma);

    await expect(remindWindow(d, SOON(), FIELD, 'завтра')).resolves.toBe(2);

    expect(sendAdmin).toHaveBeenCalledTimes(2);
    expect(sendAdmin.mock.calls[0][0]).toContain('Напоминание: сессия завтра');
    expect(table.get(8)?.[FIELD]).toBeInstanceOf(Date);
  });
});
