// DeleteAccountDto (правило №6): тело DELETE /api/user необязательно, а `code`
// — строка длиной как у кодов 2FA.
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DeleteAccountDto } from './delete-account.dto';

async function errorsFor(body: Record<string, unknown>): Promise<string[]> {
  const errs = await validate(plainToInstance(DeleteAccountDto, body), {
    whitelist: true,
  });
  return errs.map((e) => e.property);
}

describe('DeleteAccountDto', () => {
  it('пустое тело проходит (аккаунт без 2FA)', async () => {
    await expect(errorsFor({})).resolves.toEqual([]);
  });

  it('TOTP и recovery-код проходят', async () => {
    await expect(errorsFor({ code: '123456' })).resolves.toEqual([]);
    await expect(errorsFor({ code: 'a1b2c3d4e5' })).resolves.toEqual([]);
  });

  it('число вместо строки и слишком длинный/короткий код отклоняются', async () => {
    await expect(errorsFor({ code: 123456 })).resolves.toEqual(['code']);
    await expect(errorsFor({ code: '123' })).resolves.toEqual(['code']);
    await expect(errorsFor({ code: '1'.repeat(11) })).resolves.toEqual([
      'code',
    ]);
  });
});
