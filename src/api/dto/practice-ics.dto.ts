import {
  IsInt,
  IsNotEmpty,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PRACTICE_TEXT_MAX } from '../../utils/text-limits';

/** До 2100 года: шире настоящего «завтра», уже мусорных чисел. */
const START_MS_MAX = Date.UTC(2100, 0, 1);

/**
 * POST /api/plan/ics (правило №6): ссылка на .ics шага плана для Telegram
 * (аудит 2026-11, E6). `startMs` — начало события в мс UTC, его считает
 * клиент тем же planEventStartMs, что и файл с устройства.
 */
export class PracticeIcsLinkDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(PRACTICE_TEXT_MAX)
  text!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  needLabel!: string;

  @IsInt()
  @Min(0)
  @Max(START_MS_MAX)
  startMs!: number;
}
