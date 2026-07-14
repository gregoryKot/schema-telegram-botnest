// DTO-рефактор inline-типов @Body() админ-эндпоинтов сайта
// (аудит 2026-07, 2г / правило №6 CLAUDE.md). MarqueeDto — единственное
// место с вложенными объектами (topics), поэтому отдельно проверяем
// @ValidateNested + @Type: без них whitelist не тронул бы вложенные поля.
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { HeroPhotoDto, MarqueeDto } from './site-content-admin.dto';

async function errorsFor(
  cls: new () => object,
  body: Record<string, unknown>,
): Promise<string[]> {
  const dto = plainToInstance(cls, body);
  const errs = await validate(dto, { whitelist: true });
  return errs.map((e) => e.property);
}

describe('HeroPhotoDto', () => {
  it('dataUri не строка — отказ', async () => {
    await expect(errorsFor(HeroPhotoDto, { dataUri: 123 })).resolves.toContain(
      'dataUri',
    );
  });
});

describe('MarqueeDto', () => {
  const VALID = {
    group: 'A',
    topics: [{ label: 'Тревога', href: '#booking' }],
  };

  it('валидное тело проходит', async () => {
    await expect(errorsFor(MarqueeDto, VALID)).resolves.toEqual([]);
  });

  it('group вне A/B — отказ', async () => {
    await expect(
      errorsFor(MarqueeDto, { ...VALID, group: 'C' }),
    ).resolves.toContain('group');
  });

  it('вложенный topic без href — отказ (проверка ValidateNested)', async () => {
    await expect(
      errorsFor(MarqueeDto, {
        group: 'A',
        topics: [{ label: 'Тревога' }],
      }),
    ).resolves.toContain('topics');
  });
});
