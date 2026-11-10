import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { NEED_IDS } from '../../bot/bot.service';

// Вложенные DTO тела «дописать с холста» (concept-append.dto.ts): линии,
// проведённые на холсте. Контракт — ConceptAppendLink / ConceptAppendSchemaLink
// в shared/src/therapy/conceptAppend.ts (сверка — concept-append.dto.spec.ts).
// Потребности — только из NEED_IDS (= NEED_ORDER сайта), пять штук.

/** Линии режима: «схема питает режим» и «✓ режим заботится о потребности». */
export class ConceptAppendLinkDto {
  @IsString()
  @MaxLength(64)
  modeId!: string;

  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  schemaIds!: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(NEED_IDS.length)
  @IsIn(NEED_IDS, { each: true })
  needIds?: string[];
}

/** Линии «✗ схема блокирует потребность». */
export class ConceptAppendSchemaLinkDto {
  @IsString()
  @MaxLength(64)
  schemaId!: string;

  @IsArray()
  @ArrayMaxSize(NEED_IDS.length)
  @IsIn(NEED_IDS, { each: true })
  needIds!: string[];
}
