import type { Provider } from '@nestjs/common';
import { TelegramChannelTarget } from '../telegram/telegram-channel.target';
import { CHANNEL_TARGETS, type ChannelTarget } from './channel-target';
import { ChannelPublisherService } from './channel-publisher.service';
import { ChannelScheduleService } from './channel-schedule.service';

/**
 * Реестр площадок канала «Здоровый Взрослый» — единственное место, куда
 * добавляется новая (VK, MAX, ОК): адаптер ChannelTarget сюда, и он попадает
 * и в расписание, и в ручную публикацию из /zv и админки.
 */
const TARGETS = [TelegramChannelTarget];

/**
 * Провайдеры канала. Живут в TelegramModule, пока единственный адаптер —
 * телеграмный (ему нужен TELEGRAF_BOT оттуда); со второй площадкой переедут
 * в собственный модуль.
 */
export const CHANNEL_PROVIDERS: Provider[] = [
  ...TARGETS,
  {
    provide: CHANNEL_TARGETS,
    useFactory: (...targets: ChannelTarget[]) => targets,
    inject: TARGETS,
  },
  ChannelPublisherService,
  ChannelScheduleService,
];
