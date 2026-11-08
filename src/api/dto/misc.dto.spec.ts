// DTO-рефактор мелких inline-типов @Body() в api.controller.ts
// (аудит 2026-07, 2г / правило №6 CLAUDE.md).
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SaveDraftDto, UpdateNameDto, InitDto, CheckinDto } from './misc.dto';

async function errorsFor(
  cls: new () => object,
  body: Record<string, unknown>,
): Promise<string[]> {
  const dto = plainToInstance(cls, body);
  const errs = await validate(dto, { whitelist: true });
  return errs.map((e) => e.property);
}

describe('SaveDraftDto', () => {
  const startedAt = '2026-07-14T09:00:00.000Z';

  it('data — объект любой формы в границах, проходит', async () => {
    await expect(
      errorsFor(SaveDraftDto, {
        startedAt,
        data: { any: ['nested', 'shape'], n: 1 },
      }),
    ).resolves.toEqual([]);
  });

  // Реальные снимки форм сайта (SchemaEntrySheet / ModeEntrySheet /
  // useGratitudeItems): граница не должна их резать.
  it.each([
    [
      'дневник схем',
      {
        trigger: 'т'.repeat(10_000),
        thoughts: 'мысль',
        emotions: [{ id: 'anger', intensity: 3 }],
        schemaIds: ['abandonment'],
      },
    ],
    ['дневник режимов', { modeId: 'vulnerable_child', situation: 'x' }],
    ['благодарность', { items: ['раз', 'два', ''] }],
  ])('черновик «%s» проходит', async (_, data) => {
    await expect(errorsFor(SaveDraftDto, { startedAt, data })).resolves.toEqual(
      [],
    );
  });

  // Аудит 2026-11, S21: @Allow() пропускал любой JSON до 256 КБ.
  it.each([
    ['массив', ['a', 'b']],
    ['строка', 'x'.repeat(100)],
    ['число', 5],
    ['null', null],
    [
      'больше 50 ключей',
      Object.fromEntries(Array.from({ length: 51 }, (_, i) => [`k${i}`, 1])),
    ],
    ['строка длиннее поля дневника', { trigger: 'x'.repeat(10_001) }],
    ['длинная строка в глубине', { a: { b: [{ c: 'x'.repeat(10_001) }] } }],
    ['ключ длиннее поля дневника', { ['k'.repeat(10_001)]: 1 }],
  ])('data — %s → отказ', async (_, data) => {
    await expect(
      errorsFor(SaveDraftDto, { startedAt, data }),
    ).resolves.toContain('data');
  });

  it('ровно 50 ключей — проходит (граница включительно)', async () => {
    const data = Object.fromEntries(
      Array.from({ length: 50 }, (_, i) => [`k${i}`, 1]),
    );
    await expect(errorsFor(SaveDraftDto, { startedAt, data })).resolves.toEqual(
      [],
    );
  });

  it('startedAt не строка — отказ', async () => {
    await expect(
      errorsFor(SaveDraftDto, { startedAt: 123, data: {} }),
    ).resolves.toContain('startedAt');
  });
});

describe('UpdateNameDto', () => {
  it('имя длиннее 50 — отказ', async () => {
    await expect(
      errorsFor(UpdateNameDto, { name: 'x'.repeat(51) }),
    ).resolves.toContain('name');
  });

  it('валидное имя проходит', async () => {
    await expect(errorsFor(UpdateNameDto, { name: 'Мария' })).resolves.toEqual(
      [],
    );
  });
});

describe('InitDto / CheckinDto', () => {
  it('InitDto без timezone проходит', async () => {
    await expect(errorsFor(InitDto, {})).resolves.toEqual([]);
  });

  it('InitDto: пояс устройства проходит, строка длиннее 64 — отказ', async () => {
    await expect(
      errorsFor(InitDto, { timezone: 'Asia/Vladivostok' }),
    ).resolves.toEqual([]);
    await expect(
      errorsFor(InitDto, { timezone: 'x'.repeat(65) }),
    ).resolves.toContain('timezone');
  });

  it('CheckinDto требует boolean done', async () => {
    await expect(errorsFor(CheckinDto, { done: true })).resolves.toEqual([]);
    await expect(errorsFor(CheckinDto, { done: 'yes' })).resolves.toContain(
      'done',
    );
  });
});
