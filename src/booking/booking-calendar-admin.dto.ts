// @Type() (ниже) читает design-time метаданные через Reflect — полифилл
// нужен явно, как в site-content-admin.dto.ts.
import 'reflect-metadata';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO для календаря слотов в админке (контракт «Календарь слотов в
 * админке», правило №6 CLAUDE.md). Эндпоинты защищены x-admin-key, но
 * query/тело всё равно проверяются рантаймом.
 */
export class AdminCalendarQueryDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to!: string;
}

export class SlotOverrideItemDto {
  @IsISO8601()
  startsAt!: string;

  @IsInt()
  @Min(15)
  @Max(180)
  durationMin!: number;

  @IsIn(['BLOCK', 'OPEN'])
  kind!: 'BLOCK' | 'OPEN';
}

export class SlotOverridesDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => SlotOverrideItemDto)
  set?: SlotOverrideItemDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsISO8601({}, { each: true })
  clear?: string[];
}
