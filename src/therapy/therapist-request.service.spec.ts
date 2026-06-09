import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TherapistRequestService } from './therapist-request.service';

const flush = () => new Promise((r) => setImmediate(r));

function makeDeps(role: string = 'USER') {
  const tx = {
    therapistRequest: { update: jest.fn().mockResolvedValue({}) },
    user: { update: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    therapistRequest: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 7, status: 'pending', userId: 5n, fullName: 'Имя', qualification: 'q', contacts: 'c', message: null }),
      update: jest.fn().mockResolvedValue({ id: 7, status: 'pending', userId: 5n, fullName: 'Имя', qualification: 'q', contacts: 'c', message: null }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    user: { update: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn(async (cb: any) => cb(tx)),
  } as any;
  const botService = { getUserRole: jest.fn().mockResolvedValue(role) } as any;
  return { prisma, botService, tx };
}

const VALID = { fullName: 'Иван Петров', qualification: 'КПТ, 5 лет', contacts: '@ivan' };

describe('TherapistRequestService.submit', () => {
  beforeEach(() => {
    process.env.ADMIN_ID = '1';
    process.env.BOT_TOKEN = 'tok';
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as any;
  });
  afterEach(() => { (global.fetch as any) = undefined; });

  it('уже терапевт → Conflict', async () => {
    const { prisma, botService } = makeDeps('THERAPIST');
    await expect(new TherapistRequestService(prisma, botService).submit(1n, VALID)).rejects.toThrow(ConflictException);
  });

  it.each([
    ['пустое имя', { ...VALID, fullName: '' }],
    ['слишком длинное имя', { ...VALID, fullName: 'x'.repeat(101) }],
    ['пустая квалификация', { ...VALID, qualification: '' }],
    ['пустые контакты', { ...VALID, contacts: '' }],
    ['слишком длинное сообщение', { ...VALID, message: 'm'.repeat(1001) }],
  ])('невалидный ввод (%s) → BadRequest', async (_label, input) => {
    const { prisma, botService } = makeDeps();
    await expect(new TherapistRequestService(prisma, botService).submit(1n, input as any)).rejects.toThrow(BadRequestException);
  });

  it('повторная заявка в статусе pending → Conflict', async () => {
    const { prisma, botService } = makeDeps();
    prisma.therapistRequest.findUnique.mockResolvedValue({ status: 'pending' });
    await expect(new TherapistRequestService(prisma, botService).submit(1n, VALID)).rejects.toThrow('already pending');
  });

  it('повторная заявка в статусе approved → Conflict', async () => {
    const { prisma, botService } = makeDeps();
    prisma.therapistRequest.findUnique.mockResolvedValue({ status: 'approved' });
    await expect(new TherapistRequestService(prisma, botService).submit(1n, VALID)).rejects.toThrow('already approved');
  });

  it('новая заявка → create + уведомление админу', async () => {
    const { prisma, botService } = makeDeps();
    const res = await new TherapistRequestService(prisma, botService).submit(1n, VALID);
    expect(prisma.therapistRequest.create).toHaveBeenCalled();
    expect(res).toEqual({ id: 7, status: 'pending' });
    await flush();
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('/sendMessage');
  });

  it('повторная заявка после rejected → update (перезапись на pending)', async () => {
    const { prisma, botService } = makeDeps();
    prisma.therapistRequest.findUnique.mockResolvedValue({ status: 'rejected' });
    await new TherapistRequestService(prisma, botService).submit(1n, VALID);
    expect(prisma.therapistRequest.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'pending', reviewedAt: null }),
    }));
  });

  it('submit успешен, даже если уведомление админу вернуло не-2xx', async () => {
    const { prisma, botService } = makeDeps();
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429, json: async () => ({ description: 'Too Many Requests' }) }) as any;
    const res = await new TherapistRequestService(prisma, botService).submit(1n, VALID);
    expect(res.status).toBe('pending');
    await flush();
  });

  it('submit успешен, даже если уведомление упало по сети', async () => {
    const { prisma, botService } = makeDeps();
    global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as any;
    const res = await new TherapistRequestService(prisma, botService).submit(1n, VALID);
    expect(res.status).toBe('pending');
    await flush();
  });

  it('getMine возвращает заявку пользователя', async () => {
    const { prisma, botService } = makeDeps();
    prisma.therapistRequest.findUnique.mockResolvedValue({ id: 7, status: 'pending' });
    expect(await new TherapistRequestService(prisma, botService).getMine(1n)).toEqual({ id: 7, status: 'pending' });
  });

  it('HTML-escape пользовательского ввода в уведомлении админу', async () => {
    const { prisma, botService } = makeDeps();
    prisma.therapistRequest.create.mockResolvedValue({ id: 7, status: 'pending', userId: 5n, fullName: '<b>hack</b>', qualification: 'q & q', contacts: 'c', message: null });
    await new TherapistRequestService(prisma, botService).submit(1n, VALID);
    await flush();
    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.text).toContain('&lt;b&gt;hack&lt;/b&gt;');
    expect(body.text).toContain('q &amp; q');
  });
});

describe('TherapistRequestService — admin actions', () => {
  beforeEach(() => {
    process.env.ADMIN_ID = '1';
    process.env.BOT_TOKEN = 'tok';
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) }) as any;
  });
  afterEach(() => { (global.fetch as any) = undefined; });

  describe('assertAdmin', () => {
    it('listPending не-админом → Forbidden', async () => {
      const { prisma, botService } = makeDeps();
      await expect(new TherapistRequestService(prisma, botService).listPending(999)).rejects.toThrow(ForbiddenException);
    });

    it('listPending админом → возвращает pending-заявки', async () => {
      const { prisma, botService } = makeDeps();
      prisma.therapistRequest.findMany.mockResolvedValue([{ id: 1 }]);
      expect(await new TherapistRequestService(prisma, botService).listPending(1)).toEqual([{ id: 1 }]);
    });
  });

  describe('approve', () => {
    it('не-админ → Forbidden (не трогает БД)', async () => {
      const { prisma, botService } = makeDeps();
      await expect(new TherapistRequestService(prisma, botService).approve(999, 7)).rejects.toThrow(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('заявка не найдена → NotFound', async () => {
      const { prisma, botService } = makeDeps();
      prisma.therapistRequest.findUnique.mockResolvedValue(null);
      await expect(new TherapistRequestService(prisma, botService).approve(1, 7)).rejects.toThrow(NotFoundException);
    });

    it('заявка не в статусе pending → Conflict', async () => {
      const { prisma, botService } = makeDeps();
      prisma.therapistRequest.findUnique.mockResolvedValue({ id: 7, status: 'approved', userId: 5n });
      await expect(new TherapistRequestService(prisma, botService).approve(1, 7)).rejects.toThrow(ConflictException);
    });

    it('успех → транзакция повышает роль до THERAPIST и уведомляет заявителя', async () => {
      const { prisma, botService, tx } = makeDeps();
      prisma.therapistRequest.findUnique.mockResolvedValue({ id: 7, status: 'pending', userId: 5n });
      await new TherapistRequestService(prisma, botService).approve(1, 7);
      expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 5n }, data: { role: 'THERAPIST', therapistMode: true } });
      expect(tx.therapistRequest.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: 'approved' }),
      }));
      await flush();
      expect(global.fetch).toHaveBeenCalled(); // notifyApplicant
    });
  });

  describe('reject', () => {
    it('не-админ → Forbidden', async () => {
      const { prisma, botService } = makeDeps();
      await expect(new TherapistRequestService(prisma, botService).reject(999, 7, 'no')).rejects.toThrow(ForbiddenException);
    });

    it('не pending → Conflict', async () => {
      const { prisma, botService } = makeDeps();
      prisma.therapistRequest.findUnique.mockResolvedValue({ id: 7, status: 'rejected', userId: 5n });
      await expect(new TherapistRequestService(prisma, botService).reject(1, 7, 'no')).rejects.toThrow(ConflictException);
    });

    it('успех → статус rejected с причиной (обрезана до 500)', async () => {
      const { prisma, botService } = makeDeps();
      prisma.therapistRequest.findUnique.mockResolvedValue({ id: 7, status: 'pending', userId: 5n });
      await new TherapistRequestService(prisma, botService).reject(1, 7, 'причина');
      expect(prisma.therapistRequest.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: 'rejected', rejectReason: 'причина' }),
      }));
    });
  });
});
