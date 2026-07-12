import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

/**
 * Заявка на роль терапевта (аудит 2026-07, 2г): свободный текст от юзера,
 * уходит в DM админу — рантайм-валидация обязательна (правило №6 CLAUDE.md).
 */
export class SubmitTherapistRequestDto {
  @IsString()
  @Length(2, 200)
  fullName!: string;

  @IsString()
  @Length(2, 1000)
  qualification!: string;

  @IsString()
  @Length(2, 300)
  contacts!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}
