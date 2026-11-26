// @Type() (ниже) читает design-time метаданные через Reflect — полифилл
// нужен явно: в юнит-тесте DTO грузится без бутстрапа Nest (который тянет
// reflect-metadata как побочный эффект сам).
import 'reflect-metadata';
import { IsArray, IsIn, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO для админ-эндпоинтов сайта (аудит 2026-07, 2г / правило №6
 * CLAUDE.md). Формат/размер `dataUri` уже проверяется вручную в
 * контроллере — не дублируем. Topics — вложенные объекты, нужен
 * @ValidateNested + @Type, иначе whitelist их не тронет.
 */
export class HeroPhotoDto {
  @IsString()
  dataUri!: string;
}

export class MarqueeTopicDto {
  @IsString()
  label!: string;

  @IsString()
  href!: string;
}

export class MarqueeDto {
  @IsIn(['A', 'B'])
  group!: 'A' | 'B';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MarqueeTopicDto)
  topics!: MarqueeTopicDto[];
}
