import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ClientIdField } from './client-id.decorator';
import { TASK_TEXT_MAX } from '../../utils/text-limits';
import { IsCalendarDay } from '../../utils/calendar-day';

// Типы заданий из форм обоих фронтендов (TaskCreateSheet) плюс schema_diary/
// mode_diary для стрик-прогресса; 'custom' — «своё задание» (T6: был любой строкой).
const TASK_TYPES = [
  'diary_streak',
  'tracker_streak',
  'schema_diary',
  'mode_diary',
  'belief_check',
  'letter_to_self',
  'safe_place',
  'flashcard',
  'schema_intro',
  'mode_intro',
  'custom',
] as const;

/**
 * DTO для задач терапевта клиенту (аудит 2026-07, 2г / правило №6
 * CLAUDE.md). `targetDays` уже проверялся вручную (1–365) — правило
 * продублировано, ручная проверка в контроллере не удалена.
 */
export class CreateTaskDto {
  @IsString()
  @IsIn(TASK_TYPES)
  type!: string;

  // Текст из одних пробелов — не задание (QA 2026-10-26: IsNotEmpty без
  // trim его пропускал).
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(TASK_TEXT_MAX)
  text!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  targetDays?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  needId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  @IsCalendarDay()
  dueDate?: string;

  @IsOptional()
  @ClientIdField()
  clientId?: string;
}

export class CompleteTaskDto {
  @IsBoolean()
  done!: boolean;
}
