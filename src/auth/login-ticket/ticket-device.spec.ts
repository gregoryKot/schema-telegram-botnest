// Экран сверки /auth/confirm показывает устройство и время только живого
// билета входа; любой другой билет — 404, чтобы чужой код ничего не выдал.
import { NotFoundException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { hashToken } from '../email.util';
import { TicketDeviceService } from './ticket-device';

const CREATED = new Date('2026-11-15T10:00:00Z');
const live = {
  intent: 'login',
  consumedAt: null,
  deniedAt: null,
  approvedUserId: null,
  expiresAt: new Date(Date.now() + 60_000),
  deviceLabel: 'Safari, iPhone',
  createdAt: CREATED,
};

function service(row: Record<string, unknown> | null) {
  const findUnique = jest.fn().mockResolvedValue(row);
  const prisma = { loginTicket: { findUnique } } as unknown as PrismaService;
  return { svc: new TicketDeviceService(prisma), findUnique };
}

describe('TicketDeviceService.preview', () => {
  it('живой билет входа — устройство и время; код ищется по хэшу без пробелов и регистра', async () => {
    const { svc, findUnique } = service(live);
    await expect(svc.preview(' ab-cd ')).resolves.toEqual({
      deviceLabel: 'Safari, iPhone',
      createdAt: CREATED.toISOString(),
    });
    expect(findUnique).toHaveBeenCalledWith({
      where: { userCodeHash: hashToken('AB-CD') },
    });
  });

  it('пустая подпись устройства — null', async () => {
    const { svc } = service({ ...live, deviceLabel: '' });
    expect((await svc.preview('X')).deviceLabel).toBeNull();
  });

  it.each([
    ['нет билета', null],
    ['привязка, а не вход', { ...live, intent: 'link' }],
    ['погашен', { ...live, consumedAt: CREATED }],
    ['отклонён', { ...live, deniedAt: CREATED }],
    ['уже одобрен', { ...live, approvedUserId: 7 }],
    ['истёк', { ...live, expiresAt: new Date(Date.now() - 1000) }],
  ])('%s — 404', async (_name, row) => {
    await expect(service(row).svc.preview('X')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
