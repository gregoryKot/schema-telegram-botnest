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
import { CLIENT_NAME_MAX, SESSION_NOTE_MAX } from '../../utils/text-limits';
import { IsCalendarDay } from '../../utils/calendar-day';
import { NotFutureDay } from './not-future-day';

/**
 * DTO для работы терапевта с клиентскими данными (аудит 2026-07, 2г /
 * правило №6 CLAUDE.md). `date` — настоящий календарный день (IsCalendarDay):
 * регэксп формы в контроллере пропускал `2026-13-45` и `0000-00-00`.
 */
export class RenameClientDto {
  @IsString()
  @MaxLength(CLIENT_NAME_MAX)
  alias!: string;
}

export class CreateSessionNoteDto {
  @IsString()
  @MaxLength(10)
  @IsCalendarDay()
  date!: string;

  @IsString()
  @MaxLength(SESSION_NOTE_MAX)
  text!: string;
}

// therapyStartDate/nextSession: строка, null (сброс) или undefined (не менять).
// Формат (аудит 2026-10, T6) уходит в БД и карточки как есть: therapyStartDate —
// настоящий день (IsCalendarDay) не в будущем; nextSession — день или настенное
// время терапевта `YYYY-MM-DDTHH:mm[:ss]` (день без времени — встреча «в этот день»).
const DAY_OR_MOMENT_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?$/;

export class SessionInfoDto {
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  @MaxLength(10)
  @IsCalendarDay()
  @NotFutureDay()
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
