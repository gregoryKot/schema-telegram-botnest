import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

/**
 * DTO для работы терапевта с клиентскими данными (аудит 2026-07, 2г /
 * правило №6 CLAUDE.md). Формат `date` (YYYY-MM-DD) проверяется вручную
 * в контроллере — regex не дублируем.
 */
export class RenameClientDto {
  @IsString()
  @MaxLength(100)
  alias!: string;
}

export class CreateSessionNoteDto {
  @IsString()
  date!: string;

  @IsString()
  @MaxLength(10000)
  text!: string;
}

// therapyStartDate/nextSession принимают строку, null (сброс) или undefined
// (не менять) — ValidateIf пропускает проверку типа для null.
export class SessionInfoDto {
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  therapyStartDate?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  nextSession?: string | null;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  meetingDays?: number[];
}
