import { applyDecorators } from '@nestjs/common';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * Необязательный час суток — целое 0..23. Час вне суток раньше проходил и
 * ломал момент напоминания (M5 аудита 2026-10).
 */
export const OptionalHour = (): PropertyDecorator =>
  applyDecorators(IsOptional(), IsInt(), Min(0), Max(23));
