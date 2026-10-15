import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { MODE_MAP_TITLE_MAX } from '../../utils/text-limits';

/**
 * DTO карт режимов терапевта (аудит 2026-07, 2г / правило №6 CLAUDE.md).
 * `kind` — сервис сам подставляет дефолт при неизвестном значении (не
 * отклоняет запрос), поэтому слабая строка, а не `@IsIn(...)`. Длина `title` —
 * 400, а не молчаливая обрезка в контроллере (находка аудита 2026-10-11).
 */
export class CreateModeMapDto {
  @IsOptional()
  @IsString()
  @MaxLength(MODE_MAP_TITLE_MAX)
  title?: string;

  @IsOptional()
  @IsString()
  kind?: string;
}

export class UpdateModeMapDto {
  @IsOptional()
  @IsString()
  @MaxLength(MODE_MAP_TITLE_MAX)
  title?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  nodes?: unknown[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  edges?: unknown[];
}
