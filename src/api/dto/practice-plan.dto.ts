import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { NEED_IDS } from '../../bot/bot.service';

/**
 * DTO для POST /api/practices (аудит 2026-07, 2г / правило №6 CLAUDE.md).
 * `text` обрезается контроллером до 200 символов (не отклоняется) — жёсткий
 * лимит здесь не дублируем, чтобы не менять поведение.
 */
export class AddPracticeDto {
  @IsIn(NEED_IDS)
  needId!: string;

  @IsString()
  @IsNotEmpty()
  text!: string;
}

/** DTO для POST /api/plan. reminderUtcHour без явных границ в коде. */
export class CreatePlanDto {
  @IsIn(NEED_IDS)
  needId!: string;

  @IsString()
  @IsNotEmpty()
  practiceText!: string;

  @IsOptional()
  @IsInt()
  reminderUtcHour?: number;
}
