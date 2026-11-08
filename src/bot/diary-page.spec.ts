// R6 (аудит 2026-11): список дневника отдаёт 30 последних записей, а «Мой путь»
// перечисляет до 500 и открывал запись поиском в этом списке — 31-я
// открывалась пустой. Теперь запись открывается по id, а «Записи» догружают
// дневник страницами по курсору. «Сохранил → нашёл»: записи создаются
// собственным write-путём сервиса и читаются его же read-путём.
import { NotFoundException } from '@nestjs/common';
import { DiaryService } from './diary.service';
import { DIARY_PAGE_SIZE } from './diary-page';
import { createFakeTable } from '../test-support/fake-prisma.spec-helper';

const A = 1n;
const B = 2n;

function makeService() {
  // createdAt растёт с каждой строкой, как в Postgres; `sameMoment` даёт
  // нескольким строкам один момент — проверка развязки по id на границе.
  let t = Date.UTC(2026, 0, 1);
  let sameMoment = false;
  const createdAt = () => ({
    createdAt: new Date(sameMoment ? t : (t += 60_000)),
  });
  const db: any = {
    schemaDiaryEntry: createFakeTable([], { defaults: createdAt }),
    modeDiaryEntry: createFakeTable([], { defaults: createdAt }),
    gratitudeDiaryEntry: createFakeTable([], { defaults: createdAt }),
  };
  const svc = new DiaryService(db);
  const freeze = (on: boolean) => (sameMoment = on);
  return { svc, db, freeze };
}

const schemaEntry = (i: number) => ({
  trigger: `запись ${i}`,
  emotions: [],
  schemaIds: ['mistrust'],
});

describe('DiaryService — запись по id (открывает «Мой путь»)', () => {
  it('сохранил 40 записей схем → 1-я не в списке, но открывается по id', async () => {
    const { svc } = makeService();
    const created = [];
    for (let i = 1; i <= 40; i++)
      created.push(await svc.createSchemaDiaryEntry(A, schemaEntry(i)));

    const list = await svc.getSchemaDiaryEntries(A);
    expect(list.map((e) => e.id)).not.toContain(created[0].id);

    const first = await svc.getSchemaDiaryEntry(A, created[0].id);
    expect(first.trigger).toBe('запись 1');
    expect(first.schemaIds).toEqual(['mistrust']);
  });

  it('сохранил 40 записей режимов → 1-я открывается по id', async () => {
    const { svc } = makeService();
    const ids: number[] = [];
    for (let i = 1; i <= 40; i++) {
      const e = await svc.createModeDiaryEntry(A, {
        modeId: 'vulnerable_child',
        situation: `ситуация ${i}`,
      });
      ids.push(e.id);
    }
    expect((await svc.getModeDiaryEntry(A, ids[0])).situation).toBe(
      'ситуация 1',
    );
  });

  it('благодарность: старый день открывается по id с пунктами', async () => {
    const { svc } = makeService();
    const old = await svc.upsertGratitudeDiaryEntry(A, '2025-01-01', ['чай']);
    for (let d = 1; d <= 31; d++)
      await svc.upsertGratitudeDiaryEntry(A, `2026-01-${pad(d)}`, ['x']);
    const list = await svc.getGratitudeDiaryEntries(A);
    expect(list.map((e) => e.id)).not.toContain(old.id);
    expect((await svc.getGratitudeDiaryEntry(A, old.id)).items).toEqual([
      'чай',
    ]);
  });

  it('чужая и несуществующая запись — 404, по ответу их не различить', async () => {
    const { svc } = makeService();
    const mine = await svc.createSchemaDiaryEntry(A, schemaEntry(1));
    await expect(svc.getSchemaDiaryEntry(B, mine.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(svc.getModeDiaryEntry(A, 999)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(svc.getGratitudeDiaryEntry(A, 999)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

const pad = (n: number) => String(n).padStart(2, '0');

describe('DiaryService.getDiaryPage — «Показать ещё» в «Записях»', () => {
  it('40 записей: страница 30 с признаком «есть ещё», затем 10 без него, без потерь и повторов', async () => {
    const { svc } = makeService();
    for (let i = 1; i <= 40; i++)
      await svc.createSchemaDiaryEntry(A, schemaEntry(i));

    const p1 = await svc.getDiaryPage(A, 'schema');
    expect(p1.items).toHaveLength(DIARY_PAGE_SIZE);
    expect(p1.hasMore).toBe(true);
    const p2 = await svc.getDiaryPage(A, 'schema', p1.items[29].id);
    expect(p2.hasMore).toBe(false);

    const triggers = [...p1.items, ...p2.items].map(
      (e) => (e as { trigger: string }).trigger,
    );
    expect(triggers).toEqual(
      Array.from({ length: 40 }, (_, i) => `запись ${40 - i}`),
    );
  });

  it('ровно 30 записей — «есть ещё» = false, лишнего запроса не нужно', async () => {
    const { svc } = makeService();
    for (let i = 1; i <= DIARY_PAGE_SIZE; i++)
      await svc.createSchemaDiaryEntry(A, schemaEntry(i));
    expect((await svc.getDiaryPage(A, 'schema')).hasMore).toBe(false);
  });

  it('записи одного момента на границе страницы не теряются и не повторяются', async () => {
    const { svc, freeze } = makeService();
    for (let i = 1; i <= 25; i++)
      await svc.createModeDiaryEntry(A, { modeId: 'm', situation: `${i}` });
    freeze(true); // 26..40 — один и тот же createdAt
    for (let i = 26; i <= 40; i++)
      await svc.createModeDiaryEntry(A, { modeId: 'm', situation: `${i}` });

    const p1 = await svc.getDiaryPage(A, 'mode');
    const p2 = await svc.getDiaryPage(A, 'mode', p1.items[29].id);
    const ids = [...p1.items, ...p2.items].map((e) => e.id);
    expect(new Set(ids).size).toBe(40);
  });

  it('благодарность листается по дню', async () => {
    const { svc } = makeService();
    for (let d = 1; d <= 31; d++)
      await svc.upsertGratitudeDiaryEntry(A, `2026-01-${pad(d)}`, [`${d}`]);
    const p1 = await svc.getDiaryPage(A, 'gratitude');
    expect(p1.hasMore).toBe(true);
    const p2 = await svc.getDiaryPage(A, 'gratitude', p1.items[29].id);
    expect(p2).toMatchObject({ hasMore: false });
    expect(p2.items.map((e) => (e as { date: string }).date)).toEqual([
      '2026-01-01',
    ]);
  });

  it('чужой курсор — 404, а не страница чужого дневника', async () => {
    const { svc } = makeService();
    const mine = await svc.createSchemaDiaryEntry(A, schemaEntry(1));
    await svc.createSchemaDiaryEntry(B, schemaEntry(2));
    await expect(svc.getDiaryPage(B, 'schema', mine.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    const own = await svc.getDiaryPage(B, 'schema');
    expect(own.items.map((e) => e.userId)).toEqual([B]);
  });
});
