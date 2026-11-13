import { Injectable, NotFoundException } from '@nestjs/common';
import { TelegramProvider } from './telegram.provider';
import { VkProvider } from './vk.provider';
import { MaxProvider } from './max.provider';
import { YandexProvider } from './yandex.provider';
import { AuthProviderHandler } from './types';

// Единственное место, знающее всех провайдеров. Новый способ входа: файл
// foo.provider.ts → конструктор ниже → ../auth.login-providers.ts; остальное
// — docs/architecture/backend-platform.md («Новый OAuth-провайдер»).
@Injectable()
export class AuthProviderRegistry {
  private readonly map = new Map<string, AuthProviderHandler>();

  constructor(
    telegram: TelegramProvider,
    vk: VkProvider,
    max: MaxProvider,
    yandex: YandexProvider,
  ) {
    for (const p of [telegram, vk, max, yandex]) this.map.set(p.id, p);
  }

  get(id: string): AuthProviderHandler {
    const p = this.map.get(id);
    if (!p) throw new NotFoundException(`Unknown auth provider: ${id}`);
    return p;
  }

  list(): AuthProviderHandler[] {
    return [...this.map.values()];
  }
}
