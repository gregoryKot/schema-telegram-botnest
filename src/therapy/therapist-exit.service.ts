import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { endTherapistRelations } from './end-therapist-relations';
import {
  FormerTherapistInfo,
  getFormerTherapistInfo,
} from './former-therapist-info';

// Уход терапевта из приложения с двух сторон: сам отказ от роли (терапевт) и
// сообщение о бывшем терапевте (клиент). Переехало из AccountService
// (src/bot/account.service.ts): отказ от роли — терапевтический домен, а
// счётчик для /stats (правило №8) нужен рядом с транзакцией.
@Injectable()
export class TherapistExitService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
  ) {}

  // Отказ от роли терапевта: CLIENT, кабинет выключен, заявка удалена (иначе
  // 'approved' блокирует повторную), связи завершены — одной транзакцией.
  // Событие пишется после неё: track() ошибок не бросает, отказ не ломает.
  async resign(userId: bigint): Promise<void> {
    const clientsEnded = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { role: 'CLIENT', therapistMode: false },
      });
      await tx.therapistRequest.deleteMany({ where: { userId } });
      return endTherapistRelations(tx, userId);
    });
    await this.analytics.track(userId, 'therapist_resigned', { clientsEnded });
  }

  formerTherapist(clientId: bigint): Promise<FormerTherapistInfo | null> {
    return getFormerTherapistInfo(this.prisma, clientId);
  }
}
