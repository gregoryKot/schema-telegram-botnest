import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { ServeStaticModule } from '@nestjs/serve-static';
import { APP_GUARD } from '@nestjs/core';
import { join } from 'path';
import { UserThrottlerGuard } from './api/throttler.guard';
import { TelegramModule } from './telegram/telegram.module';
import { BotModule } from './bot/bot.module';
import { PrismaModule } from './prisma/prisma.module';
import { ApiModule } from './api/api.module';
import { NotificationModule } from './notification/notification.module';
import { TherapyModule } from './therapy/therapy.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000,  limit: 10  },
      { name: 'long',  ttl: 60000, limit: 200 },
    ]),
    // Single ServeStatic for everything.
    // webapp/dist serves the website at /
    // webapp/dist/app/ contains the Telegram mini app (schema-miniapp build)
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'webapp', 'dist'),
      exclude: ['/api/{*path}'],
      serveStaticOptions: {
        fallthrough: true,
      },
    }),
    PrismaModule,
    NotificationModule,
    AuthModule,
    TherapyModule,
    TelegramModule,
    BotModule,
    ApiModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: UserThrottlerGuard }],
})
export class AppModule {}
