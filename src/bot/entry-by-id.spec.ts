// R6 (аудит 2026-11): «Мой путь» открывал упражнения и попытки теста поиском
// в списке, а список отдаёт 30 последних (тест на схемы — 20): старая запись
// открывалась пустой. Теперь — по id, со скоупом по userId и той же
// расшифровкой, что у списка. «Сохранил → нашёл» идёт через сервисы.
import { NotFoundException } from '@nestjs/common';
import { ExercisesService } from './exercises.service';
import { YsqService } from './ysq.service';
import { createFakeTable } from '../test-support/fake-prisma.spec-helper';

const A = 1n;
const B = 2n;

function makeDb() {
  let t = Date.UTC(2026, 0, 1);
  const createdAt = () => ({ createdAt: new Date((t += 60_000)) });
  const completedAt = () => ({ completedAt: new Date((t += 60_000)) });
  const db: any = {
    userBeliefCheck: createFakeTable([], { defaults: createdAt }),
    userLetter: createFakeTable([], { defaults: createdAt }),
    userFlashcard: createFakeTable([], { defaults: createdAt }),
    ysqResult: createFakeTable([], { idField: 'userId' }),
    ysqResultHistory: createFakeTable([], { defaults: completedAt }),
    userTask: createFakeTable(),
  };
  db.$transaction = (ops: unknown[]) => Promise.all(ops);
  return db;
}

describe('ExercisesService — запись по id', () => {
  it('40 писем → 1-е не в списке, но открывается по id', async () => {
    const svc = new ExercisesService(makeDb());
    const ids: number[] = [];
    for (let i = 1; i <= 40; i++)
      ids.push((await svc.createLetter(A, `письмо ${i}`)).id);
    const list = await svc.getLetters(A);
    expect(list.map((l) => l.id)).not.toContain(ids[0]);
    expect((await svc.getLetter(A, ids[0])).text).toBe('письмо 1');
  });

  it('40 проверок убеждений → 1-я открывается по id со списками доводов', async () => {
    const svc = new ExercisesService(makeDb());
    const ids: number[] = [];
    for (let i = 1; i <= 40; i++) {
      const row = await svc.createBeliefCheck(A, {
        belief: `убеждение ${i}`,
        evidenceFor: ['за'],
        evidenceAgainst: ['против'],
      });
      ids.push(row.id);
    }
    const first = await svc.getBeliefCheck(A, ids[0]);
    expect(first.belief).toBe('убеждение 1');
    expect(first.evidenceAgainst).toEqual(['против']);
  });

  it('40 кризисных карточек → 1-я открывается по id', async () => {
    const svc = new ExercisesService(makeDb());
    const ids: number[] = [];
    for (let i = 1; i <= 40; i++) {
      const row = await svc.createFlashcard(A, {
        modeId: 'vulnerable_child',
        needId: 'attachment',
        action: `действие ${i}`,
      });
      ids.push(row.id);
    }
    expect((await svc.getFlashcard(A, ids[0])).action).toBe('действие 1');
  });

  it('чужая запись — 404 на каждой сущности', async () => {
    const svc = new ExercisesService(makeDb());
    const letter = await svc.createLetter(A, 'моё');
    const card = await svc.createFlashcard(A, { modeId: 'm', needId: 'n' });
    const check = await svc.createBeliefCheck(A, {
      belief: 'b',
      evidenceFor: [],
      evidenceAgainst: [],
    });
    for (const p of [
      svc.getLetter(B, letter.id),
      svc.getFlashcard(B, card.id),
      svc.getBeliefCheck(B, check.id),
    ])
      await expect(p).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('YsqService.getYsqHistoryEntry', () => {
  it('25 попыток → 1-я не в истории (20), но открывается по id с ответами', async () => {
    const db = makeDb();
    const svc = new YsqService(db);
    for (let i = 0; i < 25; i++) await svc.saveYsqResult(A, [i % 7, 1]);
    // Сервис ставит completedAt = now(): в одной миллисекунде порядок
    // неопределён, разводим попытки по минутам, как в жизни.
    const rows = db.ysqResultHistory._rows as { completedAt: Date }[];
    rows.forEach(
      (r, i) => (r.completedAt = new Date(Date.UTC(2026, 0, 1, 0, i))),
    );
    const history = await svc.getYsqHistory(A);
    expect(history).toHaveLength(20);
    const firstId = Math.min(
      ...(db.ysqResultHistory._rows as { id: number }[]).map((r) => r.id),
    );
    expect(history.map((h) => h.id)).not.toContain(firstId);
    const first = await svc.getYsqHistoryEntry(A, firstId);
    expect(first.answers).toEqual([0, 1]);
    expect(first.completedAt).toBeInstanceOf(Date);
  });

  it('чужая попытка — 404', async () => {
    const db = makeDb();
    const svc = new YsqService(db);
    await svc.saveYsqResult(A, [1, 1]);
    const [own] = await svc.getYsqHistory(A);
    await expect(svc.getYsqHistoryEntry(B, own.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
