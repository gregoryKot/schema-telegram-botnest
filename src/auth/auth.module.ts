import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard, OptionalJwtGuard } from './jwt.guard';
import { MergeService } from './merge.service';
import { AuthProviderRegistry } from './providers/registry';
import { GoogleProvider } from './providers/google.provider';
import { TelegramProvider } from './providers/telegram.provider';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [
    AuthService,
    JwtAuthGuard,
    OptionalJwtGuard,
    MergeService,
    GoogleProvider,
    TelegramProvider,
    AuthProviderRegistry,
  ],
  controllers: [AuthController],
  exports: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
