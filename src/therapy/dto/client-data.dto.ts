import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { CLIENT_NAME_MAX, SESSION_NOTE_MAX } from '../../utils/text-limits';
import { IsCalendarDay } from '../../utils/calendar-day';
import { IsDayOrWallMoment } from '../../utils/wall-moment';
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
// время терапевта `YYYY-MM-DDTHH:mm[:ss]` (день без времени — встреча «в этот день»):
// день настоящий, часы 00–23, минуты 00–59 (IsDayOrWallMoment).

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
  @IsDayOrWallMoment()
  nextSession?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  meetingDays?: number[];
}
