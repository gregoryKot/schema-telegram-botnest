import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { NEED_IDS } from '../../bot/bot.service';
import { PRACTICE_TEXT_MAX } from '../../utils/text-limits';

/** POST /api/practices (правило №6): `text` длиннее предела — 400, не обрезка (backend#29). */
export class AddPracticeDto {
  @IsIn(NEED_IDS)
  needId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(PRACTICE_TEXT_MAX)
  text!: string;
}

/** DTO для POST /api/plan. reminderUtcHour — час UTC, 0..23 (M5 аудита 2026-10). */
export class CreatePlanDto {
  @IsIn(NEED_IDS)
  needId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(PRACTICE_TEXT_MAX)
  practiceText!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  reminderUtcHour?: number;
}
