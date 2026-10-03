import { IsOptional, IsString, Length } from 'class-validator';
import { TokenBodyDto } from './auth-scalar.dto';

/**
 * Тело POST /api/auth/merge. `code` — второй фактор ПОГЛОЩАЕМОГО аккаунта
 * (6-значный TOTP или recovery-код, формат как у TwoFaCodeDto): без него
 * владелец одного лишь взломанного входа через Google мог забрать аккаунт,
 * защищённый TOTP (аудит 2026-10, A4).
 */
export class MergeConfirmDto extends TokenBodyDto {
  @IsOptional()
  @IsString()
  @Length(6, 10)
  code?: string;
}
