import { MergeService } from './merge.service';

// Достать текст SQL из объекта Prisma.Sql (strings + интерполированный Prisma.raw)
function sqlText(s: any): string {
  if (!s) return '';
  if (typeof s.sql === 'string') return s.sql;
  if (Array.isArray(s.strings)) return s.strings.join(' ');
  return String(s);
}

function makeTx() {
  const exec: any[] = [];
  const tx = {
    $executeRaw: jest.fn((s: any) => { exec.push(s); return Promise.resolve(1); }),
    $queryRaw: jest.fn().mockResolvedValue([{ re: null, rev: null }]),
  };
  return { tx, exec };
}

describe('MergeService.merge', () => {
  it('ничего не делает, если source === target (нет транзакции)', async () => {
    const prisma = { $transaction: jest.fn() } as any;
    await new MergeService(prisma).merge(5n, 5n);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('выполняет весь перенос в одной транзакции', async () => {
    const { tx } = makeTx();
    const prisma = { $transaction: jest.fn((cb: any) => cb(tx)) } as any;
    await new MergeService(prisma).merge(1n, 2n);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('начинает с удаления security-чувствительных строк source (WebSession)', async () => {
    const { tx, exec } = makeTx();
    const prisma = { $transaction: jest.fn((cb: any) => cb(tx)) } as any;
    await new MergeService(prisma).merge(1n, 2n);
    expect(sqlText(exec[0])).toContain('"WebSession"');
    expect(sqlText(exec[0])).toContain('DELETE FROM');
  });

  it('последним шагом удаляет опустевшего source-юзера', async () => {
    const { tx, exec } = makeTx();
    const prisma = { $transaction: jest.fn((cb: any) => cb(tx)) } as any;
    await new MergeService(prisma).merge(1n, 2n);
    const last = sqlText(exec[exec.length - 1]);
    expect(last).toContain('DELETE FROM "User"');
  });

  it('покрывает многоколоночные ссылки: Pair, TherapyRelation, ClientConceptualization', async () => {
    const { tx, exec } = makeTx();
    const prisma = { $transaction: jest.fn((cb: any) => cb(tx)) } as any;
    await new MergeService(prisma).merge(1n, 2n);
    const all = exec.map(sqlText).join('\n');
    expect(all).toContain('"Pair"');
    expect(all).toContain('"TherapyRelation"');
    expect(all).toContain('"TherapistNote"');
    expect(all).toContain('"ClientConceptualization"');
  });

  it('повышает роль target до THERAPIST (не понижает доступ при merge)', async () => {
    const { tx, exec } = makeTx();
    const prisma = { $transaction: jest.fn((cb: any) => cb(tx)) } as any;
    await new MergeService(prisma).merge(1n, 2n);
    const all = exec.map(sqlText).join('\n');
    expect(all).toContain(`"role" = 'THERAPIST'`);
  });

  it('переносит recoveryEmail, освобождая unique-слот source перед записью в target', async () => {
    const { tx, exec } = makeTx();
    tx.$queryRaw.mockResolvedValue([{ re: 'a@b.com', rev: new Date('2026-01-01') }]);
    const prisma = { $transaction: jest.fn((cb: any) => cb(tx)) } as any;
    await new MergeService(prisma).merge(1n, 2n);
    const emailUpdates = exec.map(sqlText).filter((t) => t.includes('"recoveryEmail"'));
    // сначала очистка на source (= NULL), затем установка на target
    expect(emailUpdates.length).toBeGreaterThanOrEqual(2);
    expect(emailUpdates.some((t) => t.includes('NULL'))).toBe(true);
  });

  it('без recoveryEmail у source блок переноса email пропускается', async () => {
    const { tx, exec } = makeTx(); // $queryRaw по умолчанию возвращает re: null
    const prisma = { $transaction: jest.fn((cb: any) => cb(tx)) } as any;
    await new MergeService(prisma).merge(1n, 2n);
    const emailUpdates = exec.map(sqlText).filter((t) => t.includes('SET "recoveryEmail" ='));
    expect(emailUpdates.length).toBe(0);
  });
});

describe('MergeService.summarize', () => {
  it('агрегирует количества и пропускает таблицы с нулём', async () => {
    const prisma = {
      $queryRaw: jest.fn()
        .mockResolvedValueOnce([{ c: 5n }])  // первая таблица
        .mockResolvedValue([{ c: 0n }]),      // остальные — ноль
    } as any;
    const counts = await new MergeService(prisma).summarize(1n);
    expect(Object.values(counts).every((n) => n > 0)).toBe(true);
    expect(counts.Rating).toBe(5); // Rating — первый в USER_OWNED_TABLES
    expect(Object.keys(counts)).toHaveLength(1);
  });

  it('устойчив к ошибке подсчёта отдельной таблицы — не падает, считает остальные', async () => {
    const prisma = {
      $queryRaw: jest.fn()
        .mockRejectedValueOnce(new Error('relation missing')) // первая таблица упала
        .mockResolvedValue([{ c: 3n }]),
    } as any;
    const counts = await new MergeService(prisma).summarize(1n);
    expect(counts.Rating).toBeUndefined();       // упавшая пропущена
    expect(Object.values(counts).length).toBeGreaterThan(0); // остальные посчитаны
  });

  it('пустой результат → пустой объект', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ c: 0n }]) } as any;
    expect(await new MergeService(prisma).summarize(1n)).toEqual({});
  });
});
