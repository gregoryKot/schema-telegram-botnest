import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * DTO for POST /api/auth/max/webapp `initData` body field — CLAUDE.md
 * правило №6 (новый эндпоинт = DTO с class-validator, не inline @Body()).
 */
export class MaxWebAppDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(8192)
  initData!: string;

  // Платформа запуска для аналитики; незнакомое — `other`, вход не роняет.
  @IsOptional()
  @IsString()
  @MaxLength(32)
  platform?: string;
}
