import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { anonymizeCutoff } from './booking-retention.service';

// Обезличивание заявок с формы знакомства по сроку. Тот же срок и тот же приём,
// что у броней (booking-retention.service.ts): 12 месяцев, затираются ровно три
// поля — clientName, clientContact, message; факт заявки (дата, канал, откуда,
// доставка) остаётся. Отсчёт от createdAt: у заявки нет даты консультации, а
// политика так и обещает («через 12 месяцев после даты консультации или
// подачи заявки, если консультации не было»; пин — booking-retention-policy.spec.ts).
//
// Пустая строка вместо шифртекста безопасна: decrypt('') отдаёт '' без
// попытки расшифровки (доказано на живой базе: test/intro-lead.e2e-spec.ts).
//
// Без leader-election (scripts/cron-leader-baseline.json — `exempt`):
// updateMany идемпотентен, второй инстанс обновит 0 строк.
@Injectable()
export class IntroLeadRetentionService {
  private readonly logger = new Logger(IntroLeadRetentionService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('47 4 * * *', { name: 'introLeadPiiRetention' })
  async anonymizeOld(now = new Date()): Promise<{ anonymized: number }> {
    try {
      const { count } = await this.prisma.introLead.updateMany({
        where: { createdAt: { lt: anonymizeCutoff(now) }, anonymizedAt: null },
        data: {
          clientName: '',
          clientContact: '',
          message: null,
          anonymizedAt: now,
        },
      });
      if (count > 0) this.logger.log(`ретеншен заявок: обезличено ${count}`);
      return { anonymized: count };
    } catch (err) {
      // Ошибка в stdout вторым аргументом: первый уходит админу в DM.
      this.logger.error('intro lead retention failed', err as Error);
      return { anonymized: 0 };
    }
  }
}
