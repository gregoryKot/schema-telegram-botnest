import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  MODE_MAP_NODE_TEXT_MAX,
  MODE_MAP_TITLE_MAX,
} from '../../utils/text-limits';
import { StringsWithin } from './strings-within';

/**
 * DTO карт режимов терапевта (аудит 2026-07, 2г / правило №6 CLAUDE.md).
 * `kind` — сервис сам подставляет дефолт при неизвестном значении (не
 * отклоняет запрос), поэтому слабая строка, а не `@IsIn(...)`. Длина `title` —
 * 400, а не молчаливая обрезка в контроллере (находка аудита 2026-10-11).
 * Узлы и связи — без схемы, но каждая строка в них ограничена: карта шлётся
 * целиком на каждое автосохранение и иначе упиралась бы в лимит тела.
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
  @StringsWithin(MODE_MAP_NODE_TEXT_MAX)
  nodes?: unknown[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(500)
  @StringsWithin(MODE_MAP_NODE_TEXT_MAX)
  edges?: unknown[];
}
