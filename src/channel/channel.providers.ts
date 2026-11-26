import type { Provider } from '@nestjs/common';
import { TelegramChannelTarget } from '../telegram/telegram-channel.target';
import { VkChannelTarget } from './targets/vk.target';
import { MaxChannelTarget } from './targets/max.target';
import { ThreadsChannelTarget } from './targets/threads.target';
import { ThreadsTokenService } from './targets/threads-token.service';
import { PinterestChannelTarget } from './targets/pinterest.target';
import { CHANNEL_TARGETS, type ChannelTarget } from './channel-target';
import { ChannelPublisherService } from './channel-publisher.service';
import { DeliveryLogService } from './delivery-log.service';
import { ChannelCheckService } from './channel-check.service';
import { ChannelScheduleService } from './channel-schedule.service';

/**
 * Реестр площадок канала «Здоровый Взрослый» — единственное место, куда
 * добавляется новая: адаптер ChannelTarget сюда, и он попадает и в
 * расписание, и в ручную публикацию из /zv и админки. Площадка без своего env
 * молчит, поэтому адаптер можно смержить раньше, чем появятся ключи.
 */
const TARGETS = [
  TelegramChannelTarget,
  VkChannelTarget,
  MaxChannelTarget,
  ThreadsChannelTarget,
  PinterestChannelTarget,
];

/**
 * Провайдеры канала. Живут в TelegramModule, пока среди адаптеров есть
 * телеграмный (ему нужен TELEGRAF_BOT оттуда).
 */
export const CHANNEL_PROVIDERS: Provider[] = [
  ...TARGETS,
  ThreadsTokenService,
  {
    provide: CHANNEL_TARGETS,
    useFactory: (...targets: ChannelTarget[]) => targets,
    inject: TARGETS,
  },
  DeliveryLogService,
  ChannelPublisherService,
  ChannelCheckService,
  ChannelScheduleService,
];
