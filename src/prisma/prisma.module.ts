import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { EncryptionWave2Service } from './encryption-wave2.service';
import { EncryptionWave3Service } from './encryption-wave3.service';
@Global()
@Module({
  providers: [PrismaService, EncryptionWave2Service, EncryptionWave3Service],
  exports: [PrismaService],
})
export class PrismaModule {}
