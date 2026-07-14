import { IsInt, IsOptional, IsString, Min, ValidateIf } from 'class-validator';

/**
 * DTO для CRUD статей блога (аудит 2026-07, 2г / правило №6 CLAUDE.md).
 * Раньше `ArticleDto` импортировался как `type` из articles.service —
 * интерфейс, рантайм не валидировался. `@nestjs/mapped-types` в проекте
 * нет — `UpdateArticleDto` написан вручную (все поля опциональны).
 */
export class ArticleDto {
  @IsString()
  slug!: string;

  @IsString()
  title!: string;

  @IsString()
  description!: string;

  @IsString()
  content!: string;

  @IsString()
  date!: string;

  @IsInt()
  @Min(0)
  readMin!: number;

  // string | null (null сбрасывает картинку/диаграмму) — ValidateIf
  // пропускает проверку типа при null, IsOptional — при undefined.
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  heroImage?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  diagramKey?: string | null;
}

export class UpdateArticleDto {
  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  readMin?: number;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  heroImage?: string | null;

  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  diagramKey?: string | null;
}
