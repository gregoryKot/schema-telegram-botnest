import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { GoogleProvider } from './google.provider';
import { TelegramProvider } from './telegram.provider';
import { VkProvider } from './vk.provider';
import { AuthProviderHandler } from './types';

// Single place that knows about all providers. Add a new auth method by:
//   1. Drop a new file in src/auth/providers/foo.provider.ts implementing AuthProviderHandler
//   2. Add it to the constructor + map below
//   3. Register the @Injectable in auth.module.ts providers
// Controller / merge logic / linking — all of it works automatically.
@Injectable()
export class AuthProviderRegistry {
  private readonly map = new Map<string, AuthProviderHandler>();

  constructor(
    google: GoogleProvider,
    telegram: TelegramProvider,
    vk: VkProvider,
  ) {
    for (const p of [google, telegram, vk]) this.map.set(p.id, p);
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
