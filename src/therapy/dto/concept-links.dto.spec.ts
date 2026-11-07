// Отметки «Делали сегодня» у техник подсказок (#995) в связях режима и схемы:
// поле `done` проходит ValidationPipe({ whitelist: true }) целиком (иначе
// отметка молча терялась бы при сохранении), с потолком длины массива и
// форматом дня; лишнее внутри отметки вырезается.
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ConceptualizationDto } from './conceptualization.dto';
import { latestTodayOnEarth } from './not-future-day';
import { CONCEPT_TECHNIQUE_MARKS_MAX } from '../../utils/text-limits';

const mark = (over: Record<string, unknown> = {}) => ({
  techniqueId: 'chairwork',
  day: '2026-11-05',
  ...over,
});
const marks = (n: number) =>
  Array.from({ length: n }, (_, i) => mark({ techniqueId: `t${i}` }));

async function check(body: Record<string, unknown>) {
  const dto = plainToInstance(ConceptualizationDto, body);
  const errs = await validate(dto, { whitelist: true });
  return { dto, errors: errs.map((e) => e.property) };
}

describe.each([
  ['modeLinks', { modeId: 'vulnerable_child' }],
  ['schemaLinks', { schemaId: 'abandonment' }],
] as const)('%s: done (отметки техник)', (field, base) => {
  const body = (done: unknown) => ({ [field]: [{ ...base, done }] });

  it('валидные отметки проходят и доезжают до сервиса целиком', async () => {
    const { dto, errors } = await check(
      body([mark(), mark({ day: '2026-10-29' })]),
    );
    expect(errors).toEqual([]);
    const link = dto[field]![0] as { done?: unknown[] };
    expect(JSON.parse(JSON.stringify(link.done))).toEqual([
      mark(),
      mark({ day: '2026-10-29' }),
    ]);
  });

  it(`ровно ${CONCEPT_TECHNIQUE_MARKS_MAX} отметок проходят, на одну больше — отказ`, async () => {
    expect(
      (await check(body(marks(CONCEPT_TECHNIQUE_MARKS_MAX)))).errors,
    ).toEqual([]);
    expect(
      (await check(body(marks(CONCEPT_TECHNIQUE_MARKS_MAX + 1)))).errors,
    ).toContain(field);
  });

  it('id техники длиннее 64 или не строка — отказ', async () => {
    expect(
      (await check(body([mark({ techniqueId: 'x'.repeat(65) })]))).errors,
    ).toContain(field);
    expect((await check(body([mark({ techniqueId: 7 })]))).errors).toContain(
      field,
    );
    expect(
      (await check(body([mark({ techniqueId: 'x'.repeat(64) })]))).errors,
    ).toEqual([]);
  });

  it.each([
    '05.11.2026',
    '2026-11-5',
    '2026-11-05T10:00:00Z',
    '',
    'x'.repeat(300),
  ])('день «%s» не YYYY-MM-DD — отказ', async (day) => {
    expect((await check(body([mark({ day })]))).errors).toContain(field);
  });

  it('день в будущем на всей Земле — отказ, самый поздний «сегодня» — проходит', async () => {
    const latest = latestTodayOnEarth();
    const after = new Date(Date.parse(`${latest}T00:00:00Z`) + 86_400_000)
      .toISOString()
      .slice(0, 10);
    expect((await check(body([mark({ day: latest })]))).errors).toEqual([]);
    expect((await check(body([mark({ day: after })]))).errors).toContain(field);
  });

  it('не массив или отметка не объект — отказ', async () => {
    expect((await check(body('chairwork'))).errors).toContain(field);
    expect((await check(body(['chairwork']))).errors).toContain(field);
  });

  it('лишнее поле внутри отметки вырезается whitelist-ом', async () => {
    const { dto, errors } = await check(body([mark({ clientId: '555' })]));
    expect(errors).toEqual([]);
    const link = dto[field]![0] as { done?: Record<string, unknown>[] };
    expect(link.done![0]).not.toHaveProperty('clientId');
    expect(link.done![0].techniqueId).toBe('chairwork');
  });
});
