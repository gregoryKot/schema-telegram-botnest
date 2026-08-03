// Реестр площадок канала: единственное место, куда добавляется новая
// площадка (правило №11 CLAUDE.md — дубли-регистрации живут незамеченными).
// Проверяем то, что легко сломать при рефакторинге: фабрика CHANNEL_TARGETS
// собирает массив из ВСЕХ адаптеров в объявленном порядке, а не теряет/
// дублирует один из них.
import { CHANNEL_PROVIDERS } from './channel.providers';
import { CHANNEL_TARGETS } from './channel-target';
import { TelegramChannelTarget } from '../telegram/telegram-channel.target';
import { VkChannelTarget } from './targets/vk.target';
import { MaxChannelTarget } from './targets/max.target';
import { ThreadsChannelTarget } from './targets/threads.target';
import { PinterestChannelTarget } from './targets/pinterest.target';
import { ThreadsTokenService } from './targets/threads-token.service';
import { ChannelPublisherService } from './channel-publisher.service';
import { DeliveryLogService } from './delivery-log.service';
import { ChannelCheckService } from './channel-check.service';
import { ChannelScheduleService } from './channel-schedule.service';

describe('CHANNEL_PROVIDERS', () => {
  it('регистрирует ровно по одному провайдеру на каждую площадку/сервис', () => {
    // Дубль в этом списке — живой мёртвый код: два инстанса одного адаптера,
    // расползающиеся при правке одного из них (правило №11).
    const expected = [
      TelegramChannelTarget,
      VkChannelTarget,
      MaxChannelTarget,
      ThreadsChannelTarget,
      PinterestChannelTarget,
      ThreadsTokenService,
      DeliveryLogService,
      ChannelPublisherService,
      ChannelCheckService,
      ChannelScheduleService,
    ];
    for (const cls of expected) {
      expect(CHANNEL_PROVIDERS).toContain(cls);
    }
    expect(new Set(CHANNEL_PROVIDERS).size).toBe(CHANNEL_PROVIDERS.length);
  });

  it('фабрика CHANNEL_TARGETS собирает адаптеры всех площадок в объявленном порядке', () => {
    const factoryEntry = CHANNEL_PROVIDERS.find(
      (
        p,
      ): p is {
        provide: string;
        useFactory: (...a: unknown[]) => unknown[];
        inject: unknown[];
      } =>
        typeof p === 'object' &&
        p !== null &&
        'provide' in p &&
        p.provide === CHANNEL_TARGETS,
    );
    expect(factoryEntry).toBeDefined();

    // inject перечисляет классы в том же порядке, в котором фабрика их вернёт —
    // новая площадка без записи здесь молчала бы (никогда не публикуется и
    // не проверяется), не роняя ничего явно.
    expect(factoryEntry!.inject).toEqual([
      TelegramChannelTarget,
      VkChannelTarget,
      MaxChannelTarget,
      ThreadsChannelTarget,
      PinterestChannelTarget,
    ]);

    const fakeTargets = factoryEntry!.inject.map((cls) => ({
      platform: (cls as { name: string }).name,
    }));
    expect(factoryEntry!.useFactory(...fakeTargets)).toEqual(fakeTargets);
  });
});
