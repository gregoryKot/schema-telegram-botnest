// @Type() читает design-time метаданные через Reflect — полифилл нужен явно.
import 'reflect-metadata';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Глубина истории трекера. Год — потолок ленты «Записи», где дневники видны
 * за всё время: до 2026-11 эндпоинт молча резал всё до 30 дней, и строки
 * трекера старше месяца из ленты пропадали, а тепловая карта (112 дней)
 * рисовала три месяца пустыми. Год оценок — до ~1,8 тыс. коротких строк по
 * индексу `[userId, date]` (сценарий `history-365d`, test/perf/scenarios.ts).
 */
export const HISTORY_MAX_DAYS = 365;
export const HISTORY_DEFAULT_DAYS = 7;

export class HistoryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(HISTORY_MAX_DAYS)
  days?: number;
}

/** Сколько дней отдать: без параметра — неделя (виджеты главной). */
export const historyDays = (q: HistoryQueryDto): number =>
  q.days ?? HISTORY_DEFAULT_DAYS;
