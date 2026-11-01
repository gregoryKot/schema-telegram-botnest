import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { DIARY_FIELD_MAX } from '../../utils/text-limits';

// DTO дневников схем и режимов (diary.controller.ts; правило №6; благодарность —
// gratitude-diary.dto.ts). Свободный текст — до DIARY_FIELD_MAX, превышение —
// 400 (backend#29); `emotions` — только число.
// id схем/режимов — формат каталога shared/src/schemaTherapy/content: [a-z_]{1,64}.
export class SchemaDiaryDto {
  @IsString()
  @MaxLength(DIARY_FIELD_MAX)
  trigger!: string;

  @IsArray()
  @ArrayMaxSize(50)
  emotions!: { id: string; intensity: number }[];

  @IsOptional()
  @IsString()
  @MaxLength(DIARY_FIELD_MAX)
  thoughts?: string;

  @IsOptional()
  @IsString()
  @MaxLength(DIARY_FIELD_MAX)
  bodyFeelings?: string;

  @IsOptional()
  @IsString()
  @MaxLength(DIARY_FIELD_MAX)
  actualBehavior?: string;

  @IsArray()
  @ArrayMaxSize(50)
  @MaxLength(64, { each: true })
  @Matches(/^[a-z_]{1,64}$/, { each: true })
  schemaIds!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(DIARY_FIELD_MAX)
  schemaOrigin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(DIARY_FIELD_MAX)
  healthyView?: string;

  @IsOptional()
  @IsString()
  @MaxLength(DIARY_FIELD_MAX)
  realProblems?: string;

  @IsOptional()
  @IsString()
  @MaxLength(DIARY_FIELD_MAX)
  excessiveReactions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(DIARY_FIELD_MAX)
  healthyBehavior?: string;
}

export class ModeDiaryDto {
  @MaxLength(64)
  @Matches(/^[a-z_]{1,64}$/)
  modeId!: string;

  @IsString()
  @MaxLength(DIARY_FIELD_MAX)
  situation!: string;

  @IsOptional()
  @IsString()
  @MaxLength(DIARY_FIELD_MAX)
  thoughts?: string;

  @IsOptional()
  @IsString()
  @MaxLength(DIARY_FIELD_MAX)
  feelings?: string;

  @IsOptional()
  @IsString()
  @MaxLength(DIARY_FIELD_MAX)
  bodyFeelings?: string;

  @IsOptional()
  @IsString()
  @MaxLength(DIARY_FIELD_MAX)
  actions?: string;

  @IsOptional()
  @IsString()
  @MaxLength(DIARY_FIELD_MAX)
  actualNeed?: string;

  @IsOptional()
  @IsString()
  @MaxLength(DIARY_FIELD_MAX)
  childhoodMemories?: string;

  // Что бы сказал Здоровый Взрослый — свободный текст, пишет клиент сам.
  @IsOptional()
  @IsString()
  @MaxLength(DIARY_FIELD_MAX)
  healthyResponse?: string;

  // Запись родилась из потока «Что случилось» (сайт): по ней «Записи» строят
  // фильтр «Случаи», а /stats — счётчик разборов. Без поля — обычная запись.
  @IsOptional()
  @IsBoolean()
  fromCase?: boolean;
}
