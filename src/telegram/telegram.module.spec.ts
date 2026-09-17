// Тест «монтажной схемы» TelegramModule: не поднимаем весь Nest-контекст
// (тяжело — тянет BotModule/NotificationModule/TherapyModule/AnalyticsModule
// со всеми их провайдерами), а читаем метаданные декоратора @Module(...)
// напрямую через Reflect (то же, что делает NestFactory при компиляции).
// До этого теста файл был непокрыт — 0% (аудит покрытия src/telegram 2026-08).
// Ловит реальный класс бага: кто-то забыл добавить новый сервис в providers
// или экспорт в exports — сервис зарегистрирован, но недоступен зависящим
// модулям (DI бросит только в рантайме, а не на этом тесте — здесь фиксируем
// состав списка).
// TelegramModule тянет TherapyModule → AuthModule → GoogleProvider → 'jose'
// (чистый ESM-пакет, ts-jest его не парсит — см. тот же приём в
// google.provider.spec.ts). Мокаем ниже уровнем, реальная JWKS-логика тут
// не участвует — нужен только сам факт успешного импорта модуля.
jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn(() => 'FAKE_JWKS_SET'),
  jwtVerify: jest.fn(),
}));

import { MODULE_METADATA } from '@nestjs/common/constants';
import { TelegramModule } from './telegram.module';
import { TelegramService } from './telegram.service';
import { TelegramScheduleService } from './telegram.schedule.service';
import { TelegramSettingsService } from './telegram.settings.service';
import { TelegramNotifyActionsService } from './telegram.notify-actions.service';
import { TelegramNotifySettingsService } from './telegram.notify-settings.service';
import { TelegramQuizService } from './telegram.quiz.service';
import { HealthyAdultAdminController } from './healthy-adult-admin.controller';

describe('TelegramModule — метаданные @Module', () => {
  it('экспортирует TelegramService и TelegramScheduleService (нужны другим модулям)', () => {
    const exportsList = Reflect.getMetadata(
      MODULE_METADATA.EXPORTS,
      TelegramModule,
    );
    expect(exportsList).toEqual([TelegramService, TelegramScheduleService]);
  });

  it('регистрирует HealthyAdultAdminController как единственный контроллер', () => {
    const controllers = Reflect.getMetadata(
      MODULE_METADATA.CONTROLLERS,
      TelegramModule,
    );
    expect(controllers).toEqual([HealthyAdultAdminController]);
  });

  it('providers содержит все telegram-сервисы бота (не забыт ни один при регистрации)', () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      TelegramModule,
    );
    for (const svc of [
      TelegramService,
      TelegramScheduleService,
      TelegramSettingsService,
      TelegramNotifyActionsService,
      TelegramNotifySettingsService,
      TelegramQuizService,
    ]) {
      expect(providers).toContain(svc);
    }
  });
});
