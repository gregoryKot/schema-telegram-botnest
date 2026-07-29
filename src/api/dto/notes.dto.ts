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

export const NOTE_MAX = 3000;

// Поля, общие для карточки схемы и карточки режима (правило №11 — одна
// механика ввода не копипастится). Схема-специфичные (`reality`) и
// режим-специфичные (`needs`) поля — в дочерних классах.
export class NoteFieldsDto {
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
  healthyView?: string;

  @IsOptional()
  @IsString()
  @MaxLength(NOTE_MAX)
  behavior?: string;
}

export class SchemaNoteDto extends NoteFieldsDto {
  @IsString()
  schemaId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(NOTE_MAX)
  reality?: string;
}

export class ModeNoteDto extends NoteFieldsDto {
  @IsString()
  modeId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(NOTE_MAX)
  needs?: string;
}
