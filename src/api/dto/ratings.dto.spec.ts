// DTO-рефактор inline-типов @Body() (аудит 2026-07, 2г / правило №6
// CLAUDE.md): needId/value/answers раньше проверялись только
// compile-time интерфейсом — рантайм пропускал что угодно.
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SaveRatingDto, YsqProgressDto, YsqResultDto } from './ratings.dto';

async function errorsFor(
  cls: new () => object,
  body: Record<string, unknown>,
): Promise<string[]> {
  const dto = plainToInstance(cls, body);
  const errs = await validate(dto, { whitelist: true });
  return errs.map((e) => e.property);
}

describe('SaveRatingDto', () => {
  const VALID = { needId: 'attachment', value: 5, date: '2026-07-14' };

  it('валидное тело проходит', async () => {
    await expect(errorsFor(SaveRatingDto, VALID)).resolves.toEqual([]);
  });

  it('needId не из списка потребностей — отказ', async () => {
    await expect(
      errorsFor(SaveRatingDto, { ...VALID, needId: 'hacked' }),
    ).resolves.toContain('needId');
  });

  it('value вне 0–10 — отказ', async () => {
    await expect(
      errorsFor(SaveRatingDto, { ...VALID, value: 11 }),
    ).resolves.toContain('value');
    await expect(
      errorsFor(SaveRatingDto, { ...VALID, value: -1 }),
    ).resolves.toContain('value');
  });

  it('date опционален', async () => {
    const { date, ...rest } = VALID;
    void date;
    await expect(errorsFor(SaveRatingDto, rest)).resolves.toEqual([]);
  });
});

describe('YsqProgressDto / YsqResultDto', () => {
  const answers116 = Array.from({ length: 116 }, () => 3);

  it('116 ответов 0–6 проходят', async () => {
    await expect(
      errorsFor(YsqProgressDto, { answers: answers116, page: 0 }),
    ).resolves.toEqual([]);
    await expect(
      errorsFor(YsqResultDto, { answers: answers116 }),
    ).resolves.toEqual([]);
  });

  it('неверная длина массива — отказ', async () => {
    await expect(
      errorsFor(YsqProgressDto, { answers: answers116.slice(0, 10), page: 0 }),
    ).resolves.toContain('answers');
  });

  it('ответ вне 0–6 — отказ', async () => {
    const bad = [...answers116];
    bad[0] = 7;
    await expect(
      errorsFor(YsqProgressDto, { answers: bad, page: 0 }),
    ).resolves.toContain('answers');
  });
});
