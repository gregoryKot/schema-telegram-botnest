import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { NEED_IDS } from '../../bot/bot.service';
import { PRACTICE_TEXT_MAX } from '../../utils/text-limits';
import { OptionalHour } from './optional-hour';

/** POST /api/practices (правило №6): `text` длиннее предела — 400, не обрезка (backend#29). */
export class AddPracticeDto {
  @IsIn(NEED_IDS)
  needId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(PRACTICE_TEXT_MAX)
  text!: string;
}

/**
 * DTO для POST /api/plan. `reminderLocalHour` — час по поясу человека
 * (notifyTimezone): день и момент напоминания считает сервер (E11 аудита
 * 2026-11). `reminderUtcHour` — час UTC от старых клиентов, принимается на
 * переходный срок; пришли оба — главный местный.
 */
export class CreatePlanDto {
  @IsIn(NEED_IDS)
  needId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(PRACTICE_TEXT_MAX)
  practiceText!: string;

  @OptionalHour()
  reminderLocalHour?: number;

  @OptionalHour()
  reminderUtcHour?: number;
}
