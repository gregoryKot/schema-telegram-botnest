import { ArrayMaxSize, IsArray, IsOptional, IsString } from 'class-validator';

/**
 * DTO для карт режимов и кастомных режимов терапевта (аудит 2026-07, 2г /
 * правило №6 CLAUDE.md). `nodeType`/`kind` — сервис сам подставляет
 * дефолт при неизвестном значении (не отклоняет запрос), поэтому здесь
 * оставлены слабой строкой, а не `@IsIn(...)`, чтобы не менять поведение
 * с «тихого фолбэка» на «400».
 */
export class CustomModeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  emoji?: string;

  @IsOptional()
  @IsString()
  nodeType?: string;
}

export class CreateModeMapDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  kind?: string;
}

export class UpdateModeMapDto {
  @IsOptional()
  @IsString()
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
