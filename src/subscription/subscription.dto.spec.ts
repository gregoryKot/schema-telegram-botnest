// L4 (аудит 2026-08, правило №6): SubscribeDto заменил inline-interface на
// публичном эндпоинте подписки. Проверяем, что нестроковый email и мусорный
// period дают чистый отказ, а не 500 / молчаливую месячную подписку.
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SubscribeDto } from './subscription.dto';

async function errorsFor(body: Record<string, unknown>): Promise<string[]> {
  const dto = plainToInstance(SubscribeDto, body);
  const errs = await validate(dto, { whitelist: true });
  return errs.map((e) => e.property);
}

describe('SubscribeDto — рантайм-валидация публичного эндпоинта подписки', () => {
  it('валидное тело проходит', async () => {
    await expect(
      errorsFor({ period: 'year', email: 'a@b.co', acceptedOffer: true }),
    ).resolves.toEqual([]);
  });

  it('пустое тело проходит (все поля опциональны, цену берёт сервер)', async () => {
    await expect(errorsFor({})).resolves.toEqual([]);
  });

  it('period вне союза month|year — отказ (раньше молча становился месячным)', async () => {
    await expect(errorsFor({ period: 'week' })).resolves.toContain('period');
  });

  it('нестроковый email (раньше 500 на .trim) — чистый отказ (L4)', async () => {
    await expect(errorsFor({ email: ['a@b.co'] })).resolves.toContain('email');
  });

  it('acceptedOffer не boolean — отказ', async () => {
    await expect(errorsFor({ acceptedOffer: 'yes' })).resolves.toContain(
      'acceptedOffer',
    );
  });

  it('honeypot website — декорированное поле (переживает whitelist): валидная строка проходит', async () => {
    await expect(errorsFor({ website: 'bot' })).resolves.toEqual([]);
  });
});
