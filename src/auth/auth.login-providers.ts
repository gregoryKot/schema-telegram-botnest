// Провайдеры AuthModule про способы входа: площадки (src/auth/providers), их
// реестр и общий хвост OAuth-колбэков. Вынесены из auth.module.ts, чтобы новый
// способ входа не раздувал модуль (правило №10; образец —
// src/bot/bot.internal-providers.ts). Новый провайдер — строка здесь и
// параметр конструктора AuthProviderRegistry.
import { AuthProviderRegistry } from './providers/registry';
import { TelegramProvider } from './providers/telegram.provider';
import { VkProvider } from './providers/vk.provider';
import { MaxProvider } from './providers/max.provider';
import { YandexProvider } from './providers/yandex.provider';
import { OAuthCallbackService } from './oauth-callback.service';

export const LOGIN_PROVIDERS = [
  TelegramProvider,
  VkProvider,
  MaxProvider,
  YandexProvider,
  AuthProviderRegistry,
  OAuthCallbackService,
];
