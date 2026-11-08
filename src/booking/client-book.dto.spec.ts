// Рантайм-валидация тела POST /api/client-booking/book (#546, правило №6):
// денежная ручка под входом. Имя, контакт и привязку к аккаунту тело нести
// не может — их берёт сервер из подписи и аккаунта.
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ClientBookDto } from './client-book.dto';

const VALID = { startsAt: '2026-07-13T13:00:00.000Z' };

async function errorsFor(body: Record<string, unknown>): Promise<string[]> {
  const dto = plainToInstance(ClientBookDto, body);
  const errs = await validate(dto, { whitelist: true });
  return errs.map((e) => e.property);
}

describe('ClientBookDto', () => {
  it('валидное тело проходит, пояс и длительность — необязательны', async () => {
    await expect(errorsFor(VALID)).resolves.toEqual([]);
    await expect(
      errorsFor({ ...VALID, durationMin: 50, clientTimeZone: 'Asia/Bangkok' }),
    ).resolves.toEqual([]);
  });

  it('валюта — только из списка (выбор при поясе без места, Р5)', async () => {
    for (const currency of ['RUB', 'ILS', 'EUR', 'USD'])
      await expect(errorsFor({ ...VALID, currency })).resolves.toEqual([]);
    for (const currency of ['XXX', 'eur', 5])
      await expect(errorsFor({ ...VALID, currency })).resolves.toEqual([
        'currency',
      ]);
  });

  it('мусор вместо даты и пустое тело — отказ', async () => {
    await expect(errorsFor({ startsAt: 'завтра' })).resolves.toContain(
      'startsAt',
    );
    await expect(errorsFor({})).resolves.toContain('startsAt');
  });

  it('пояс длиннее 64 символов и длительность вне 15–180 — отказ', async () => {
    const errs = await errorsFor({
      ...VALID,
      clientTimeZone: 'x'.repeat(65),
      durationMin: 600,
    });
    expect(errs).toEqual(
      expect.arrayContaining(['clientTimeZone', 'durationMin']),
    );
  });

  it('userId, clientTelegramId и имя из тела срезаются whitelist-ом (C-9)', async () => {
    const dto = plainToInstance(ClientBookDto, {
      ...VALID,
      userId: 1,
      clientTelegramId: 42,
      clientName: 'Чужое имя',
    });
    expect(await validate(dto, { whitelist: true })).toEqual([]);
    for (const k of ['userId', 'clientTelegramId', 'clientName'])
      expect(dto).not.toHaveProperty(k);
  });
});
