// @Type() (ниже) читает design-time метаданные через Reflect — полифилл
// нужен явно: в юнит-тесте DTO грузится без бутстрапа Nest.
import 'reflect-metadata';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  CONCEPT_MODE_ALIAS_MAX,
  CONCEPT_MODE_TEXT_MAX,
  CONCEPT_SCHEMA_TEXT_MAX,
  CONCEPT_TECHNIQUE_MARKS_MAX,
} from '../../utils/text-limits';
import { ConceptTechniqueMarkDto } from './concept-technique-mark.dto';

// Вложенные DTO связей графической концептуализации вынесены из
// conceptualization.dto.ts (правило №10: файл не растёт вместе со списком).
// Вложенный объект: без @ValidateNested + @Type в родителе whitelist его не
// тронул бы — лишние поля внутри связи прошли бы насквозь. Так же вложены
// отметки «Делали сегодня» (`done`, #995).

/**
 * Связи одного режима в графической концептуализации (контракт —
 * `ConceptModeLink` в shared/src/apiTypes.ts). Свободный текст (alias,
 * origin, manifest, strategy) — клиническая запись терапевта, шифруется
 * вместе со всем массивом в `therapy-notes.service.ts`.
 */
export class ConceptModeLinkDto {
  @IsString()
  @MaxLength(64)
  modeId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(CONCEPT_MODE_ALIAS_MAX)
  alias?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  schemaIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  needIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(CONCEPT_MODE_TEXT_MAX)
  origin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(CONCEPT_MODE_TEXT_MAX)
  manifest?: string;

  @IsOptional()
  @IsString()
  @MaxLength(CONCEPT_MODE_TEXT_MAX)
  strategy?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(CONCEPT_TECHNIQUE_MARKS_MAX)
  @ValidateNested({ each: true })
  @Type(() => ConceptTechniqueMarkDto)
  done?: ConceptTechniqueMarkDto[];
}

/**
 * Тексты одной схемы в графической концептуализации (контракт —
 * `ConceptSchemaLink` в shared/src/apiTypes.ts): убеждение клиента и
 * детский опыт, из которого схема выросла, плюс блокируемые потребности.
 * Свободный текст (belief, origin) — клиническая запись терапевта, шифруется
 * вместе со всем массивом в `therapy-notes.service.ts`.
 */
export class ConceptSchemaLinkDto {
  @IsString()
  @MaxLength(64)
  schemaId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(CONCEPT_SCHEMA_TEXT_MAX)
  belief?: string;

  @IsOptional()
  @IsString()
  @MaxLength(CONCEPT_SCHEMA_TEXT_MAX)
  origin?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  needIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(CONCEPT_TECHNIQUE_MARKS_MAX)
  @ValidateNested({ each: true })
  @Type(() => ConceptTechniqueMarkDto)
  done?: ConceptTechniqueMarkDto[];
}
