// C-8 (аудит 2026-10): updateMany/deleteMany с userId в WHERE молча отвечали
// успехом, когда не нашли строку, — по ответу нельзя было отличить удаление от
// попытки тронуть чужое. Теперь count === 0 → 404 (как phrase-check.service).
// Тест на уровне сервиса: все точки входа (бот, API) идут через него.
import { NotFoundException } from '@nestjs/common';
import { DiaryService } from './diary.service';
import { ExercisesService } from './exercises.service';
import { PracticesService } from './practices.service';
import { deleteOwned, requireAffected } from '../utils/require-affected';

const fake = (count: number) => ({
  deleteMany: jest.fn(async () => ({ count })),
  updateMany: jest.fn(async () => ({ count })),
});

function prismaWith(count: number) {
  return {
    schemaDiaryEntry: fake(count),
    modeDiaryEntry: fake(count),
    gratitudeDiaryEntry: fake(count),
    userBeliefCheck: fake(count),
    userLetter: fake(count),
    userFlashcard: fake(count),
    userPractice: fake(count),
    practicePlan: fake(count),
  } as never;
}

const CASES: Array<[string, (p: never) => Promise<unknown>]> = [
  [
    'deleteSchemaDiaryEntry',
    (p) => new DiaryService(p).deleteSchemaDiaryEntry(1n, 5),
  ],
  [
    'deleteModeDiaryEntry',
    (p) => new DiaryService(p).deleteModeDiaryEntry(1n, 5),
  ],
  [
    'deleteGratitudeDiaryEntry',
    (p) => new DiaryService(p).deleteGratitudeDiaryEntry(1n, 5),
  ],
  [
    'deleteBeliefCheck',
    (p) => new ExercisesService(p).deleteBeliefCheck(1n, 5),
  ],
  ['deleteLetter', (p) => new ExercisesService(p).deleteLetter(1n, 5)],
  ['deleteFlashcard', (p) => new ExercisesService(p).deleteFlashcard(1n, 5)],
  ['deletePractice', (p) => new PracticesService(p).deletePractice(1n, 5)],
  ['checkinPlan', (p) => new PracticesService(p).checkinPlan(1n, 5, true)],
];

describe('удаление/чек-ин по (id, userId): 404, если строки нет или она чужая', () => {
  it.each(CASES)('%s: count 0 → NotFoundException', async (_n, call) => {
    await expect(call(prismaWith(0))).rejects.toThrow(NotFoundException);
  });

  it.each(CASES)('%s: count 1 (владелец) → успех', async (_n, call) => {
    await expect(call(prismaWith(1))).resolves.not.toBeInstanceOf(Error);
  });
});

describe('require-affected', () => {
  it('requireAffected: count > 0 отдаёт результат как есть', async () => {
    await expect(
      requireAffected(Promise.resolve({ count: 2 })),
    ).resolves.toEqual({
      count: 2,
    });
  });

  it('deleteOwned: ищет строго по (id, userId) и называет сущность в 404', async () => {
    const d = fake(0);
    await expect(deleteOwned(d, 7, 3n, 'Letter')).rejects.toThrow(
      'Letter not found',
    );
    expect(d.deleteMany).toHaveBeenCalledWith({ where: { id: 7, userId: 3n } });
  });
});
