import { IsIn, IsObject, IsOptional } from 'class-validator';
import { PUBLIC_ANALYTICS_EVENTS } from '../../analytics/analytics.constants';

// DTO для POST /api/public-event — АНОНИМНЫЙ приём событий публичного сайта
// (мини-тесты «без регистрации», клики лендинга). name — только из узкого
// публичного среза allow-list'а: остальная аналитика по-прежнему требует
// авторизации (POST /api/event). Поля meta валидируются в контроллере по
// реестрам (quiz-registry, места клика) — произвольный объект в БД не попадёт.
export class PublicEventDto {
  @IsIn(PUBLIC_ANALYTICS_EVENTS)
  name!: string;

  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown>;
}
