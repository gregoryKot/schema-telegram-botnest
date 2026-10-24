// Подпись для обезличенной брони в админке: пустое имя (стёрто кроном по
// сроку, booking-retention.service.ts) не должно читаться как безымянная
// строка. Календарь слотов проверен в admin-calendar.service.spec.ts, здесь —
// сами хелперы и второй потребитель, список записей (listBookings).
import { encryptRecord } from '../utils/crypto';
import { BOOKING_SCHEMA } from './booking.schema';
import { getBookingById, listBookings } from './booking.queries';
import {
  ANONYMIZED_CLIENT_LABEL,
  decryptBookingForAdmin,
  displayClientName,
} from './booking-admin-view';

describe('displayClientName', () => {
  it('обычное имя отдаёт как есть', () => {
    expect(displayClientName('Мария')).toBe('Мария');
  });

  it('пустая строка (стёрто по сроку) — подпись «обезличено»', () => {
    expect(displayClientName('')).toBe(ANONYMIZED_CLIENT_LABEL);
    expect(ANONYMIZED_CLIENT_LABEL).toBe('обезличено');
  });

  it('только пробелы, null и undefined — тоже подпись, а не пустота', () => {
    expect(displayClientName('   ')).toBe(ANONYMIZED_CLIENT_LABEL);
    expect(displayClientName(null)).toBe(ANONYMIZED_CLIENT_LABEL);
    expect(displayClientName(undefined)).toBe(ANONYMIZED_CLIENT_LABEL);
  });

  it('имя с пробелами по краям не обрезается (меняется только пустое)', () => {
    expect(displayClientName(' Мария ')).toBe(' Мария ');
  });
});

describe('listBookings — имя обезличенной брони', () => {
  const row = (id: number, clientName: string, anonymizedAt: Date | null) =>
    encryptRecord(
      {
        id,
        startsAt: new Date('2025-01-10T10:00:00Z'),
        durationMin: 50,
        status: 'CONFIRMED',
        clientName,
        clientContact: clientName ? 'maria@example.com' : '',
        message: null,
        anonymizedAt,
      },
      BOOKING_SCHEMA,
    );

  it('в админском списке стёртое имя — с подписью, обычное — как записано, остальные поля целы', async () => {
    const stamp = new Date('2026-02-01T04:41:00Z');
    const prisma = {
      booking: {
        findMany: jest.fn(async () => [
          row(1, 'Мария', null),
          row(2, '', stamp),
        ]),
      },
    };
    const [normal, anonymized] = await listBookings(
      prisma as never,
      BOOKING_SCHEMA,
      'past',
    );
    expect(normal.clientName).toBe('Мария');
    expect(normal.clientContact).toBe('maria@example.com');
    expect(anonymized.clientName).toBe('обезличено');
    expect(anonymized.clientContact).toBe('');
    expect(anonymized.anonymizedAt).toEqual(stamp);
    expect(anonymized.id).toBe(2);
  });
});

describe('decryptBookingForAdmin', () => {
  it('расшифровывает по умолчанию схемой брони и оставляет остальные поля', () => {
    const plain = decryptBookingForAdmin(
      encryptRecord(
        {
          id: 3,
          clientName: 'Мария',
          clientContact: 'maria@example.com',
          message: 'позвоните вечером',
          meetingUrl: 'https://zoom.example/3?pwd=x',
        },
        BOOKING_SCHEMA,
      ),
    );
    expect(plain).toEqual({
      id: 3,
      clientName: 'Мария',
      clientContact: 'maria@example.com',
      message: 'позвоните вечером',
      meetingUrl: 'https://zoom.example/3?pwd=x',
    });
  });

  it('стёртое имя (пустая строка) и стёртый контакт: имя — подпись, контакт остаётся пустым', () => {
    const plain = decryptBookingForAdmin(
      encryptRecord(
        { id: 4, clientName: '', clientContact: '', message: null },
        BOOKING_SCHEMA,
      ),
    );
    expect(plain.clientName).toBe('обезличено');
    expect(plain.clientContact).toBe('');
    expect(plain.message).toBeNull();
  });
});

describe('getBookingById — имя обезличенной брони', () => {
  it('стёртое имя — с подписью, обычное — как записано', async () => {
    const rows: Record<number, ReturnType<typeof encryptRecord>> = {
      1: encryptRecord({ id: 1, clientName: 'Мария' }, BOOKING_SCHEMA),
      2: encryptRecord({ id: 2, clientName: '' }, BOOKING_SCHEMA),
    };
    const prisma = {
      booking: {
        findUnique: jest.fn(
          async ({ where }: { where: { id: number } }) => rows[where.id],
        ),
      },
    };
    const normal = await getBookingById(prisma as never, BOOKING_SCHEMA, 1);
    const anonymized = await getBookingById(prisma as never, BOOKING_SCHEMA, 2);
    expect(normal.clientName).toBe('Мария');
    expect(anonymized.clientName).toBe('обезличено');
  });
});
