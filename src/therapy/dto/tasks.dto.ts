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

// Типы заданий из форм создания обоих фронтендов (TaskCreateSheet) плюс
// schema_diary/mode_diary, которые понимает стрик-прогресс на бэке; 'custom' —
// «своё задание» (аудит 2026-10, T6: тип был любой строкой).
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

  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
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
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dueDate?: string;

  @IsOptional()
  @IsInt()
  clientId?: number;
}

export class CompleteTaskDto {
  @IsBoolean()
  done!: boolean;
}
