import { PrismaService } from '../prisma/prisma.service';
import {
  formatIntroLeads,
  IntroLeadMetrics,
} from './intro-lead-metrics.format';

const WEEK_MS = 7 * 86_400_000;

// Счётчики заявок с формы знакомства для /stats. Prisma count, не сырой SQL:
// иначе нужна запись в scripts/raw-sql-live-baseline.json (правило №18).
// Подключается через BookingRetentionMetricsService (соседний блок про данные
// записей), чтобы не плодить провайдеров в BotModule (правило №10).
export class IntroLeadMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async render(): Promise<string> {
    return formatIntroLeads(await this.getMetrics());
  }

  async getMetrics(now = new Date()): Promise<IntroLeadMetrics> {
    const weekAgo = new Date(now.getTime() - WEEK_MS);
    const lost = { tgDeliveredAt: null, emailDeliveredAt: null };
    const [week, weekLost, olderLost] = await Promise.all([
      this.prisma.introLead.count({ where: { createdAt: { gte: weekAgo } } }),
      this.prisma.introLead.count({
        where: { createdAt: { gte: weekAgo }, ...lost },
      }),
      this.prisma.introLead.count({
        where: { createdAt: { lt: weekAgo }, anonymizedAt: null, ...lost },
      }),
    ]);
    return { week, weekLost, olderLost };
  }
}
