import { Module } from '@nestjs/common';
import { ThrottleHitCleanupService } from './throttle-hit.cleanup';

// Отдельным модулем, а не провайдером в ApiModule (правило №10: ApiModule
// упёрся в потолок файл-храповика). PrismaModule глобальный — отдельный
// импорт не нужен.
@Module({
  providers: [ThrottleHitCleanupService],
})
export class ThrottleHitModule {}
