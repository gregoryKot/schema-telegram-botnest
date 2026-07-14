// Тест рантайм-валидации BookDto (аудит 2026-07, 2г): до DTO тело
// публичного платёжного эндпоинта проверялось только compile-time
// интерфейсом — рантайм пропускал что угодно.
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BookDto } from './book.dto';

const VALID = {
  startsAt: '2026-07-13T09:00:00.000Z',
  durationMin: 50,
  type: 'SESSION_50',
  clientName: 'Мария',
  clientContact: '@maria',
  acceptedOffer: true,
};

async function errorsFor(body: Record<string, unknown>): Promise<string[]> {
  const dto = plainToInstance(BookDto, body);
  const errs = await validate(dto, { whitelist: true });
  return errs.map((e) => e.property);
}

describe('BookDto — рантайм-валидация платёжного эндпоинта', () => {
  it('валидное тело проходит', async () => {
    await expect(errorsFor(VALID)).resolves.toEqual([]);
  });

  it('мусор вместо даты — отказ', async () => {
    await expect(
      errorsFor({ ...VALID, startsAt: 'not-a-date' }),
    ).resolves.toContain('startsAt');
  });

  it('длительность вне 15–180 — отказ', async () => {
    await expect(errorsFor({ ...VALID, durationMin: 600 })).resolves.toContain(
      'durationMin',
    );
    await expect(errorsFor({ ...VALID, durationMin: 1 })).resolves.toContain(
      'durationMin',
    );
  });

  it('несуществующий тип сессии — отказ', async () => {
    await expect(errorsFor({ ...VALID, type: 'HACK' })).resolves.toContain(
      'type',
    );
  });

  it('без имени/контакта/оферты — отказ', async () => {
    const props = await errorsFor({ startsAt: VALID.startsAt });
    expect(props).toEqual(
      expect.arrayContaining(['clientName', 'clientContact', 'acceptedOffer']),
    );
  });

  it('гигантское message — отказ (DoS/спам)', async () => {
    await expect(
      errorsFor({ ...VALID, message: 'x'.repeat(3000) }),
    ).resolves.toContain('message');
  });
});
