import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * DTO для POST /api/client-errors (best-practice «видимость прода», 2026-07).
 * Раньше падение любого раздела фронтенда ловил ErrorBoundary, но наружу
 * ничего не уходило — краши UI были невидимы (белый экран у юзера, тишина у
 * нас). Теперь ErrorBoundary шлёт сюда, а бэкенд логирует через AlertLogger →
 * DM админу. Эндпоинт публичный (краш возможен и до авторизации), поэтому
 * тело строго валидируется (правило №6) и обрезается по длине.
 */
export class ClientErrorDto {
  @IsString()
  @MaxLength(500)
  message!: string;

  @IsString()
  @MaxLength(120)
  section!: string;

  @IsIn(['webapp', 'miniapp'])
  source!: 'webapp' | 'miniapp';

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  stack?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  componentStack?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  url?: string;
}
