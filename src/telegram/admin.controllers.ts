import { HealthyAdultAdminController } from './healthy-adult-admin.controller';
import { AnalyticsAdminController } from './analytics-admin.controller';

/** Админские ручки под x-admin-key, живущие в TelegramModule. */
export const TELEGRAM_ADMIN_CONTROLLERS = [
  HealthyAdultAdminController,
  AnalyticsAdminController,
];
