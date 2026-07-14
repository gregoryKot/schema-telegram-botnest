import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * DTO для POST /api/note, /api/schema-notes, /api/mode-notes
 * (аудит 2026-07, 2г / правило №6 CLAUDE.md). Формат `date`
 * (YYYY-MM-DD) и `schemaId`/`modeId` (`[a-z_]{1,64}`) уже проверяются
 * вручную в контроллере — regex не дублируем.
 */
export class SaveNoteDto {
  @IsString()
  date!: string;

  @IsString()
  @MaxLength(10000)
  text!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

const NOTE_MAX = 3000;

export class SchemaNoteDto {
  @IsString()
  schemaId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(NOTE_MAX)
  triggers?: string;

  @IsOptional()
  @IsString()
  @MaxLength(NOTE_MAX)
  feelings?: string;

  @IsOptional()
  @IsString()
  @MaxLength(NOTE_MAX)
  thoughts?: string;

  @IsOptional()
  @IsString()
  @MaxLength(NOTE_MAX)
  origins?: string;

  @IsOptional()
  @IsString()
  @MaxLength(NOTE_MAX)
  reality?: string;

  @IsOptional()
  @IsString()
  @MaxLength(NOTE_MAX)
  healthyView?: string;

  @IsOptional()
  @IsString()
  @MaxLength(NOTE_MAX)
  behavior?: string;
}

export class ModeNoteDto {
  @IsString()
  modeId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(NOTE_MAX)
  triggers?: string;

  @IsOptional()
  @IsString()
  @MaxLength(NOTE_MAX)
  feelings?: string;

  @IsOptional()
  @IsString()
  @MaxLength(NOTE_MAX)
  thoughts?: string;

  @IsOptional()
  @IsString()
  @MaxLength(NOTE_MAX)
  needs?: string;

  @IsOptional()
  @IsString()
  @MaxLength(NOTE_MAX)
  behavior?: string;
}
