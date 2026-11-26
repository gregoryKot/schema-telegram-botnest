// Тест на шве «кабинет → ручка отвязки».
// Инцидент 2026-11 (волна 6): кабинет слал POST /api/auth/unlink/email, а
// ручка принимала только id из AuthProviderRegistry (google, telegram, vk,
// max) и отвечала 400 «Unknown provider» — почту отвязать было нельзя.
// Тесты стояли по обе стороны шва, но не на нём (docs/INCIDENTS.md, класс 7
// «Тест не на шве»). С 2026-11 то же про google: вход через Google убран и
// обработчика в реестре нет, но строки остались — кабинет их отвязывает. Здесь: ключи словаря кабинета (PROVIDER_NAMES, читаем
// как текст) против настоящего контроллера с настоящим реестром провайдеров.
import { readFileSync } from 'fs';
import { join } from 'path';
import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { AuthLinkController } from './auth-link.controller';
import { AuthProviderRegistry } from './providers/registry';
import { TelegramProvider } from './providers/telegram.provider';
import { VkProvider } from './providers/vk.provider';
import { MaxProvider } from './providers/max.provider';
import { YandexProvider } from './providers/yandex.provider';
import type { AuthService } from './auth.service';
import type { SecurityLogService } from './security-log.service';
import type { SecurityNoticeService } from './security-notice.service';

function cabinetProviderIds(): string[] {
  const src = readFileSync(
    join(__dirname, '../../webapp/src/pages/account/providerNames.ts'),
    'utf8',
  );
  const body = /PROVIDER_NAMES[^=]*=\s*\{([\s\S]*?)\n\};/.exec(src)?.[1] ?? '';
  return [...body.matchAll(/^\s*(\w+):/gm)].map((m) => m[1]);
}

function build() {
  const config = {} as unknown as ConfigService;
  const registry = new AuthProviderRegistry(
    new TelegramProvider(),
    new VkProvider(config),
    new MaxProvider(config),
    new YandexProvider(config),
  );
  const auth = { unlinkProvider: jest.fn().mockResolvedValue(undefined) };
  const notice = {
    notify: jest.fn(),
    emailAddresses: jest.fn().mockResolvedValue([]),
  };
  const controller = new AuthLinkController(
    auth as unknown as AuthService,
    registry,
    { log: jest.fn() } as unknown as SecurityLogService,
    notice as unknown as SecurityNoticeService,
  );
  return { controller, auth };
}

const req = { webUser: { userId: 'u1' }, ip: '1.1.1.1' } as unknown as Request;

describe('ручка отвязки принимает всё, что отвязывает кабинет', () => {
  const ids = cabinetProviderIds();

  it('из PROVIDER_NAMES вытащены все шесть способов входа', () => {
    expect([...ids].sort()).toEqual([
      'email',
      'google',
      'max',
      'telegram',
      'vk',
      'yandex',
    ]);
  });

  it.each(ids)('%s: не получает «Unknown provider»', async (provider) => {
    const { controller, auth } = build();
    await expect(controller.unlink(provider, req)).resolves.toEqual({
      ok: true,
    });
    expect(auth.unlinkProvider).toHaveBeenCalledWith('u1', provider);
  });

  it('контроль: выдуманный провайдер foo не принимается', async () => {
    const { controller, auth } = build();
    await expect(controller.unlink('foo', req)).rejects.toThrow(
      BadRequestException,
    );
    expect(auth.unlinkProvider).not.toHaveBeenCalled();
  });
});
