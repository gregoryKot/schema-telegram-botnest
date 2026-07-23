import { IsIn, IsObject, IsOptional } from 'class-validator';
import { PUBLIC_ANALYTICS_EVENTS } from '../../analytics/analytics.constants';

// DTO для POST /api/public-event — АНОНИМНЫЙ приём событий мини-тестов с
// сайта (лид-магнит «тесты без регистрации»). name — только из узкого
// публичного среза allow-list'а: остальная аналитика по-прежнему требует
// авторизации (POST /api/event). Поля meta валидируются в контроллере по
// реестру тестов (quiz-registry) — произвольный объект в БД не попадёт.
export class PublicEventDto {
  @IsIn(PUBLIC_ANALYTICS_EVENTS)
  name!: string;

  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown>;
}
