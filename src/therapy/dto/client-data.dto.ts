import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
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
// Формат (аудит 2026-10, T6): строки уходят в БД и в карточки клиента как есть.
// therapyStartDate — календарный день YYYY-MM-DD. nextSession — день либо
// момент `YYYY-MM-DDTHH:mm[:ss]` (поле <input type="datetime-local"> сайта
// шлёт именно его; строгая дата сломала бы «следующую сессию» с временем).
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_OR_MOMENT_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/;

export class SessionInfoDto {
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(10)
  @Matches(DAY_RE)
  therapyStartDate?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(19)
  @Matches(DAY_OR_MOMENT_RE)
  nextSession?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  meetingDays?: number[];
}
