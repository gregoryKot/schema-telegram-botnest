import { Global, Module } from '@nestjs/common';
import { CronLeaderService } from './cron-leader.service';

// Глобальный по той же причине, что и PrismaModule: кроны живут в разных
// модулях (канал, телеграм, бронирование, auth), и каждому нужен один и тот
// же арендодатель. Регистрировать провайдер в каждом модуле — тот самый
// дубль провайдеров, который запрещён правилами проекта.
@Global()
@Module({
  providers: [CronLeaderService],
  exports: [CronLeaderService],
})
export class CronLeaderModule {}
