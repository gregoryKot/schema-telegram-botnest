import { IsOptional, IsString, Length } from 'class-validator';

/**
 * Тело DELETE /api/user. `code` — второй фактор: 6-значный TOTP или
 * recovery-код (формат как у TwoFaCodeDto / MergeConfirmDto). Нужен, только
 * если у аккаунта включён TOTP; без 2FA тело можно не слать вовсе
 * (аудит 2026-10, B-13 — необратимое действие под одним access-токеном).
 */
export class DeleteAccountDto {
  @IsOptional()
  @IsString()
  @Length(6, 10)
  code?: string;
}
