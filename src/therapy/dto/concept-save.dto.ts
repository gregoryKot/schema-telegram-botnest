// @Type() (ниже) читает design-time метаданные через Reflect — полифилл
// нужен явно: в юнит-тесте DTO грузится без бутстрапа Nest.
import 'reflect-metadata';
import {
  ArrayMaxSize,
  IsArray,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ConceptModeLinkDto, ConceptSchemaLinkDto } from './concept-links.dto';
import {
  CONCEPT_MODE_LINKS_MAX,
  CONCEPT_SCHEMA_LINKS_MAX,
  ConceptualizationDto,
} from './conceptualization.dto';

// Частичное сохранение концептуализации (POST /api/therapy/conceptualization/
// :clientId, контракт — shared/src/therapy/conceptGraph/conceptPatch.ts).
// Полное тело (ConceptualizationDto) принимается как раньше — для вкладок со
// старым бандлом; сайт шлёт только изменённое: поля и списки целиком, связи —
// по одной (`upsert` по id, `remove` — id убранных), не больше
// CONCEPT_PATCH_LINKS_MAX связей каждого вида на запрос. Худшее такое тело
// меньше потолка тела запроса — сверка в concept-save.dto.spec.ts.

/** Связей каждого вида в одном запросе. Зеркало — shared conceptPatch.ts (сверка — спек DTO). */
export const CONCEPT_PATCH_LINKS_MAX = 6;

export class ConceptModeLinksPatchDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(CONCEPT_PATCH_LINKS_MAX)
  @ValidateNested({ each: true })
  @Type(() => ConceptModeLinkDto)
  upsert?: ConceptModeLinkDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(CONCEPT_MODE_LINKS_MAX)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  remove?: string[];
}

export class ConceptSchemaLinksPatchDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(CONCEPT_PATCH_LINKS_MAX)
  @ValidateNested({ each: true })
  @Type(() => ConceptSchemaLinkDto)
  upsert?: ConceptSchemaLinkDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(CONCEPT_SCHEMA_LINKS_MAX)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  remove?: string[];
}

export class ConceptSaveDto extends ConceptualizationDto {
  /**
   * updatedAt строки, от которой вкладка считала патч; null — «строки ещё не
   * было». Не совпало — 409, вкладка перечитывает и повторяет свои правки.
   * Не прислан (старый бандл) — без проверки, как раньше.
   */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @IsISO8601()
  baseVersion?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => ConceptModeLinksPatchDto)
  modeLinksPatch?: ConceptModeLinksPatchDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ConceptSchemaLinksPatchDto)
  schemaLinksPatch?: ConceptSchemaLinksPatchDto;
}
