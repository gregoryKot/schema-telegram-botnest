// L4 (аудит 2026-08): сырые @Body('email'/'token'/'initData') скаляры в
// auth-контроллерах не валидировались — нестроковое значение роняло контроллер
// TypeError'ом (createHash(число) / [].toLowerCase()) → 500. Мелкие DTO дают
// чистый отказ валидации (400). Тут проверяем сам тип-гейт.
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { EmailBodyDto, TokenBodyDto, InitDataBodyDto } from './auth-scalar.dto';

async function errorsFor(
  cls: new () => object,
  body: Record<string, unknown>,
): Promise<string[]> {
  const dto = plainToInstance(cls, body);
  const errs = await validate(dto, { whitelist: true });
  return errs.map((e) => e.property);
}

describe('auth-scalar DTO — тип тела auth-эндпоинтов (L4)', () => {
  it('EmailBodyDto: строка проходит, массив/число — отказ (раньше 500 на .toLowerCase)', async () => {
    await expect(errorsFor(EmailBodyDto, { email: 'a@b.co' })).resolves.toEqual(
      [],
    );
    await expect(
      errorsFor(EmailBodyDto, { email: ['a@b.co'] }),
    ).resolves.toContain('email');
    await expect(errorsFor(EmailBodyDto, { email: 123 })).resolves.toContain(
      'email',
    );
  });

  it('TokenBodyDto: строка проходит, число — отказ (раньше 500 на createHash)', async () => {
    await expect(errorsFor(TokenBodyDto, { token: 'abc' })).resolves.toEqual(
      [],
    );
    await expect(errorsFor(TokenBodyDto, { token: 123 })).resolves.toContain(
      'token',
    );
  });

  it('InitDataBodyDto: строка проходит, объект — отказ', async () => {
    await expect(
      errorsFor(InitDataBodyDto, { initData: 'x=1&y=2' }),
    ).resolves.toEqual([]);
    await expect(
      errorsFor(InitDataBodyDto, { initData: { x: 1 } }),
    ).resolves.toContain('initData');
  });
});
