import { applyDecorators } from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsInt, IsOptional, Min } from 'class-validator';

/** Пункты плана, над которыми работали на сессии; чужие id отбрасывает сервис. */
export const PlanItemIds = () =>
  applyDecorators(
    IsOptional(),
    IsArray(),
    ArrayMaxSize(50),
    IsInt({ each: true }),
    Min(1, { each: true }),
  );
