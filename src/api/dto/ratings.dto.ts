import {
  ArrayMaxSize,
  ArrayMinSize,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { NEED_IDS } from '../../bot/bot.service';

/**
 * DTO для POST /api/rating (аудит 2026-07, 2г / правило №6 CLAUDE.md); date
 * (YYYY-MM-DD) проверяет контроллер. Шкала 1–10 (2026-11): сайт пишет словами
 * 2/4/6/8/10, старые 1–10 читаются как есть; 0 — «не оценено», ни один экран
 * его не показывает, и сервер его больше не принимает.
 */
export class SaveRatingDto {
  @IsIn(NEED_IDS)
  needId!: string;

  @IsInt()
  @Min(1)
  @Max(10)
  value!: number;

  @IsOptional()
  @IsString()
  date?: string;
}

/**
 * DTO для POST/PUT YSQ-прогресса и результата. 116 вопросов, ответы по
 * 6-балльной шкале Лайкерта (0–6) — оба лимита уже проверялись вручную.
 */
export class YsqProgressDto {
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  @ArrayMinSize(116)
  @ArrayMaxSize(116)
  answers!: number[];

  @IsInt()
  @Min(0)
  page!: number;
}

export class YsqResultDto {
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  @ArrayMinSize(116)
  @ArrayMaxSize(116)
  answers!: number[];
}
