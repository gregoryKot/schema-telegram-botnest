import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * DTO для задач терапевта клиенту (аудит 2026-07, 2г / правило №6
 * CLAUDE.md). `targetDays` уже проверялся вручную (1–365) — правило
 * продублировано, ручная проверка в контроллере не удалена.
 */
export class CreateTaskDto {
  @IsString()
  @IsNotEmpty()
  type!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(10000)
  text!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  targetDays?: number;

  @IsOptional()
  @IsString()
  needId?: string;

  @IsOptional()
  @IsString()
  dueDate?: string;

  @IsOptional()
  @IsInt()
  clientId?: number;
}

export class CompleteTaskDto {
  @IsBoolean()
  done!: boolean;
}
