import { IsNotEmpty, IsString, Length, MaxLength } from 'class-validator';

/**
 * DTO for the 2FA `code` body field (auth.controller.ts: 2fa/enable,
 * 2fa/disable, 2fa/recovery-codes, 2fa/challenge) — CLAUDE.md правило №6.
 *
 * Before this DTO, `code` was pulled via `@Body('code') code: string`
 * (compile-time type only). A JSON body with a *numeric* code sailed past
 * the controller's `if (!code)` guard, then TotpService's `code.trim()`
 * threw a bare TypeError (numbers have no `.trim`), surfacing as a 500
 * instead of a 400 (see test/auth-flows.e2e-spec.ts).
 *
 * Length 6–10 covers both formats TotpService.verifyCode() accepts:
 * a 6-digit TOTP code (otplib default) or a 10-hex-char recovery code
 * (RECOVERY_CODE_BYTES=5 → 10 hex chars, see totp.service.ts). confirmSetup
 * (used by 2fa/enable) only ever expects the 6-digit form — the DTO stays
 * permissive on the exact format; TotpService does the real check via
 * authenticator.check()/hashCode() comparison. No trim/regex here: the
 * service already trims internally (code.trim()), so leading/trailing
 * whitespace within the length budget still round-trips correctly.
 */
export class TwoFaCodeDto {
  @IsString()
  @Length(6, 10)
  code!: string;
}

/** 2fa/challenge also carries the short-lived challengeToken (a signed JWT). */
export class TwoFaChallengeDto extends TwoFaCodeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  challengeToken!: string;
}
