// GoogleOneTapDto (CLAUDE.md правило №6) — рантайм-валидация декораторами.
// Форма credential (компактный JWT из трёх base64url-сегментов) отсекается ЗДЕСЬ,
// до похода в верификатор Google: мусор не доходит до GoogleProvider.verifyIdToken.
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { GoogleOneTapDto } from './google-one-tap.dto';

async function errorsFor(body: Record<string, unknown>): Promise<string[]> {
  const dto = plainToInstance(GoogleOneTapDto, body);
  const errs = await validate(dto, { whitelist: true });
  return errs.map((e) => e.property);
}

describe('GoogleOneTapDto', () => {
  it('компактный JWT из трёх сегментов проходит', async () => {
    await expect(errorsFor({ credential: 'aaa.bbb.ccc' })).resolves.toEqual([]);
  });

  it('реалистичный header.payload.sig с base64url-символами проходит', async () => {
    const jwt = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxMjM0NSJ9.sig_ABC-def_012';
    await expect(errorsFor({ credential: jwt })).resolves.toEqual([]);
  });

  it('пустая строка отклоняется', async () => {
    await expect(errorsFor({ credential: '' })).resolves.toContain(
      'credential',
    );
  });

  it('не-JWT строка отклоняется @Matches', async () => {
    await expect(errorsFor({ credential: 'not-a-jwt' })).resolves.toContain(
      'credential',
    );
  });

  it('строка из двух сегментов отклоняется', async () => {
    await expect(errorsFor({ credential: 'aaa.bbb' })).resolves.toContain(
      'credential',
    );
  });

  it('строка длиннее 8192 символов отклоняется @MaxLength', async () => {
    const tooLong = `${'a'.repeat(9000)}.bbb.ccc`;
    await expect(errorsFor({ credential: tooLong })).resolves.toContain(
      'credential',
    );
  });
});
