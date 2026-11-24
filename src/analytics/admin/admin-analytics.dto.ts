import { Type } from 'class-transformer';
import { IsIn, IsOptional } from 'class-validator';
import {
  ADMIN_ANALYTICS_DAYS,
  type AdminAnalyticsDays,
} from './admin-analytics.types';

export const DEFAULT_ADMIN_DAYS: AdminAnalyticsDays = 30;

export class AdminAnalyticsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsIn(ADMIN_ANALYTICS_DAYS)
  days?: AdminAnalyticsDays;
}
