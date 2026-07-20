import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { EncryptionWave2Service } from './encryption-wave2.service';

@Global()
@Module({
  providers: [PrismaService, EncryptionWave2Service],
  exports: [PrismaService],
})
export class PrismaModule {}
