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
 * DTO для POST /api/rating (аудит 2026-07, 2г / правило №6 CLAUDE.md).
 * needId/value уже проверялись вручную в контроллере — правила продублированы
 * здесь как рантайм-валидация; ручная проверка date (формат YYYY-MM-DD)
 * остаётся в контроллере — regex дублировать не стали.
 */
export class SaveRatingDto {
  @IsIn(NEED_IDS)
  needId!: string;

  @IsInt()
  @Min(0)
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
