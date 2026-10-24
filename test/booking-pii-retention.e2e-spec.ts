// Обезличивание броней по сроку (L3 аудита 2026-07-20, решение владельца
// 2026-10-08) на РЕАЛЬНОМ Postgres. Юнит-спек с моком updateMany проверяет,
// что в него уходит; здесь — что из этого выходит в базе:
//   - запись plaintext '' в шифрованную колонку и обратное чтение через драйвер
//     и decryptRecord — свойство Prisma, Postgres и src/utils/crypto.ts, мок его
//     не проверит (decrypt('') обязан отдать '' без исключения и без алерта);
//   - колонка anonymizedAt приезжает новой миграцией (…_booking_pii_retention);
//   - граница окна считается СУБД: `startsAt < cutoff` — строго «меньше».
//
// Изоляция: прогон идёт с фиксированным «сейчас» в 2001 году, поэтому окно
// захватывает только строки с startsAt до 2000 года — то есть исключительно
// фикстуры этого спека. Реальные брони (2026+) и фикстуры соседних спеков
// (2091) под условие не попадают, на какой бы базе спек ни запускался.
// Фикстуры метятся cancelToken'ом с общим префиксом, по нему же чистятся.
import { PrismaService } from '../src/prisma/prisma.service';
import { BookingRetentionService } from '../src/booking/booking-retention.service';
import { BOOKING_SCHEMA } from '../src/booking/booking.schema';
import { decryptRecord, encryptRecord } from '../src/utils/crypto';

const MARK = 'e2e-pii-retention-';
const DAY_MS = 86_400_000;
const NOW = new Date('2001-06-15T04:41:00.000Z');
// Граница окна для NOW — ровно год назад (см. anonymizeCutoff).
const CUTOFF = new Date('2000-06-15T04:41:00.000Z');
const LATER = new Date('2001-06-16T04:41:00.000Z');

const OFFER_AT = new Date('2000-03-01T10:00:00.000Z');

async function createBooking(
  prisma: PrismaService,
  tag: string,
  startsAt: Date,
): Promise<{ id: number }> {
  const data = encryptRecord(
    {
      startsAt,
      durationMin: 50,
      type: 'SESSION_50' as const,
      status: 'CONFIRMED' as const,
      clientName: `Имя ${tag}`,
      clientContact: `contact-${tag}@example.com`,
      clientChannel: 'email',
      message: `Запрос ${tag}`,
      cancelToken: `${MARK}${tag}`,
      calDavUid: `${MARK}${tag}@e2e`,
      meetingUrl: `https://zoom.example/${tag}?pwd=secret`,
      source: '/e2e',
      clientTimeZone: 'Europe/Moscow',
      acceptedOfferAt: OFFER_AT,
    },
    BOOKING_SCHEMA,
  );
  return prisma.booking.create({ data, select: { id: true } });
}

describe('обезличивание броней по сроку на реальном Postgres', () => {
  let prisma: PrismaService;
  let service: BookingRetentionService;
  const ids: Record<string, number> = {};

  async function cleanup(): Promise<void> {
    await prisma.booking.deleteMany({
      where: { cancelToken: { startsWith: MARK } },
    });
  }

  const row = (tag: string) =>
    prisma.booking.findUniqueOrThrow({ where: { id: ids[tag] } });

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    service = new BookingRetentionService(prisma);
    await cleanup();
    ids.old = (
      await createBooking(prisma, 'old', new Date('2000-04-15T10:00:00.000Z'))
    ).id; // 14 месяцев до NOW
    ids.onBoundary = (await createBooking(prisma, 'onBoundary', CUTOFF)).id;
    ids.dayFresher = (
      await createBooking(
        prisma,
        'dayFresher',
        new Date(CUTOFF.getTime() + DAY_MS),
      )
    ).id;
    ids.fresh = (
      await createBooking(prisma, 'fresh', new Date('2001-05-15T10:00:00.000Z'))
    ).id; // 1 месяц до NOW
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it('контроль фикстуры: до прогона в БД лежит шифртекст, а не открытые данные', async () => {
    const raw = await row('old');
    expect(raw.clientName).not.toBe('Имя old');
    expect(raw.clientContact).not.toContain('@example.com');
    expect(raw.anonymizedAt).toBeNull();
    expect(decryptRecord(raw, BOOKING_SCHEMA).clientName).toBe('Имя old');
  });

  it('старая бронь: имя, контакт, текст стёрты, метка стоит, факт записи на месте', async () => {
    const before = await row('old');
    const result = await service.anonymizeOld(NOW);
    expect(result).toEqual({ anonymized: 1 });

    const after = await row('old');
    expect(after.clientName).toBe('');
    expect(after.clientContact).toBe('');
    expect(after.message).toBeNull();
    expect(after.anonymizedAt?.getTime()).toBe(NOW.getTime());

    // Остальное — учётный след, он остаётся как был (в том числе meetingUrl,
    // который хранится шифртекстом и крон не трогает).
    expect(after.startsAt).toEqual(before.startsAt);
    expect(after.durationMin).toBe(before.durationMin);
    expect(after.type).toBe('SESSION_50');
    expect(after.status).toBe('CONFIRMED');
    expect(after.acceptedOfferAt).toEqual(OFFER_AT);
    expect(after.cancelToken).toBe(before.cancelToken);
    expect(after.calDavUid).toBe(before.calDavUid);
    expect(after.clientChannel).toBe('email');
    expect(after.clientTimeZone).toBe('Europe/Moscow');
    expect(after.source).toBe('/e2e');
    expect(after.meetingUrl).toBe(before.meetingUrl);
    expect(decryptRecord(after, BOOKING_SCHEMA).meetingUrl).toBe(
      'https://zoom.example/old?pwd=secret',
    );
  });

  it("чтение обезличенной строки через decryptRecord отдаёт '', а не мусор и не исключение", async () => {
    const after = await row('old');
    const plain = decryptRecord(after, BOOKING_SCHEMA);
    expect(plain.clientName).toBe('');
    expect(plain.clientContact).toBe('');
    expect(plain.message).toBeNull();
  });

  it('граница: бронь ровно на границе и на день свежее не тронуты', async () => {
    for (const tag of ['onBoundary', 'dayFresher']) {
      const r = await row(tag);
      expect(r.anonymizedAt).toBeNull();
      const plain = decryptRecord(r, BOOKING_SCHEMA);
      expect(plain.clientName).toBe(`Имя ${tag}`);
      expect(plain.clientContact).toBe(`contact-${tag}@example.com`);
      expect(plain.message).toBe(`Запрос ${tag}`);
    }
  });

  it('свежая бронь (месяц назад) не тронута: имя и контакт читаются как записаны', async () => {
    const r = await row('fresh');
    expect(r.anonymizedAt).toBeNull();
    const plain = decryptRecord(r, BOOKING_SCHEMA);
    expect(plain.clientName).toBe('Имя fresh');
    expect(plain.clientContact).toBe('contact-fresh@example.com');
    expect(plain.message).toBe('Запрос fresh');
  });

  it('повторный прогон идемпотентен: уже обезличенная строка не меняется, anonymizedAt тот же', async () => {
    const before = await row('old');
    const again = await service.anonymizeOld(LATER);
    // Бронь на границе к LATER (+1 сутки) уже старше года — её законно берёт
    // этот прогон; обезличенная 'old' в выборку не попадает.
    expect(again).toEqual({ anonymized: 1 });

    const after = await row('old');
    expect(after.anonymizedAt?.getTime()).toBe(NOW.getTime());
    expect(after.updatedAt).toEqual(before.updatedAt);
    expect(after.clientName).toBe('');

    const boundary = await row('onBoundary');
    expect(boundary.anonymizedAt?.getTime()).toBe(LATER.getTime());
    expect(decryptRecord(boundary, BOOKING_SCHEMA).clientName).toBe('');
  });

  it('прогон, которому нечего обезличивать, возвращает 0 и ничего не трогает', async () => {
    const before = await row('fresh');
    await expect(service.anonymizeOld(LATER)).resolves.toEqual({
      anonymized: 0,
    });
    const after = await row('fresh');
    expect(after.updatedAt).toEqual(before.updatedAt);
    expect(after.anonymizedAt).toBeNull();
  });
});
