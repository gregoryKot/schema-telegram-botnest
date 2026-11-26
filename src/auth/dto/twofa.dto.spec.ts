// TwoFaCodeDto/TwoFaChallengeDto (CLAUDE.md правило №6) — regression test for
// the bug this DTO fixes: a numeric `code` used to crash TotpService with a
// bare TypeError (500) instead of failing validation (400). See
// test/auth-flows.e2e-spec.ts for the HTTP-level confirmation.
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TwoFaCodeDto, TwoFaChallengeDto } from './twofa.dto';

async function errorsFor(
  cls: new () => object,
  body: Record<string, unknown>,
): Promise<string[]> {
  const dto = plainToInstance(cls, body);
  const errs = await validate(dto, { whitelist: true });
  return errs.map((e) => e.property);
}

describe('TwoFaCodeDto', () => {
  it('6-digit TOTP code passes', async () => {
    await expect(errorsFor(TwoFaCodeDto, { code: '123456' })).resolves.toEqual(
      [],
    );
  });

  it('10-char hex recovery code passes', async () => {
    await expect(
      errorsFor(TwoFaCodeDto, { code: 'a1b2c3d4e5' }),
    ).resolves.toEqual([]);
  });

  it('numeric code (the crash bug) is rejected, not silently coerced', async () => {
    await expect(errorsFor(TwoFaCodeDto, { code: 123456 })).resolves.toContain(
      'code',
    );
  });

  it('missing code is rejected', async () => {
    await expect(errorsFor(TwoFaCodeDto, {})).resolves.toContain('code');
  });

  it('too short / too long codes are rejected', async () => {
    await expect(errorsFor(TwoFaCodeDto, { code: '123' })).resolves.toContain(
      'code',
    );
    await expect(
      errorsFor(TwoFaCodeDto, { code: 'x'.repeat(11) }),
    ).resolves.toContain('code');
  });

  it('junk fields are stripped by whitelist (matches the global ValidationPipe)', async () => {
    const dto = plainToInstance(TwoFaCodeDto, {
      code: '123456',
      admin: true,
    }) as any;
    expect(dto.admin).toBe(true); // present pre-validation…
    const errs = await validate(dto, { whitelist: true });
    expect(errs).toEqual([]);
    expect(dto.admin).toBeUndefined(); // …validate({whitelist:true}) strips it in place
  });
});

describe('TwoFaChallengeDto', () => {
  const VALID = { challengeToken: 'signed.jwt.token', code: '123456' };

  it('valid body passes', async () => {
    await expect(errorsFor(TwoFaChallengeDto, VALID)).resolves.toEqual([]);
  });

  it('missing challengeToken is rejected', async () => {
    const { challengeToken, ...rest } = VALID;
    void challengeToken;
    await expect(errorsFor(TwoFaChallengeDto, rest)).resolves.toContain(
      'challengeToken',
    );
  });

  it('numeric code is rejected here too (inherits TwoFaCodeDto)', async () => {
    await expect(
      errorsFor(TwoFaChallengeDto, { ...VALID, code: 123456 }),
    ).resolves.toContain('code');
  });
});
