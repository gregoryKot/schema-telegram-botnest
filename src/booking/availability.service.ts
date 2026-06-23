import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateRuleDto {
  dayOfWeek: number;
  startHour: number;
  startMinute?: number;
  endHour: number;
  endMinute?: number;
  sessionDuration?: number;
  bufferMin?: number;
  timezone?: string;
}

/** CRUD for therapist availability rules. Admin-only endpoints. */
@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    return this.prisma.availabilityRule.findMany({ orderBy: [{ dayOfWeek: 'asc' }, { startHour: 'asc' }] });
  }

  async create(dto: CreateRuleDto) {
    return this.prisma.availabilityRule.create({
      data: {
        dayOfWeek: dto.dayOfWeek,
        startHour: dto.startHour,
        startMinute: dto.startMinute ?? 0,
        endHour: dto.endHour,
        endMinute: dto.endMinute ?? 0,
        sessionDuration: dto.sessionDuration ?? 50,
        bufferMin: dto.bufferMin ?? 10,
        timezone: dto.timezone ?? 'Europe/Moscow',
      },
    });
  }

  async setActive(id: number, isActive: boolean) {
    const rule = await this.prisma.availabilityRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException('Rule not found');
    return this.prisma.availabilityRule.update({ where: { id }, data: { isActive } });
  }

  async remove(id: number) {
    const rule = await this.prisma.availabilityRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException('Rule not found');
    await this.prisma.availabilityRule.delete({ where: { id } });
    return { ok: true };
  }
}
