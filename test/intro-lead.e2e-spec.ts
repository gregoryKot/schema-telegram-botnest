// Находка глобального аудита 2026-10-11: POST /api/booking (простая форма
// знакомства на визитке) не писал в БД — только fire-and-forget DM и письмо;
// мертвы оба канала — заявка исчезала без следа, ответ всегда ok:true.
//
// Только живой Postgres (CI-джоба `migrations`). Юнит-спеки с мок-Prisma
// доказывают порядок вызовов; здесь — то, что доказывает только база (правила
// №14 и №18): строка действительно создаётся через HTTP с хоста визитки
// (kotlarewski.gr — маршрут в allow-list practice-domain.middleware), в колонке
// лежит шифртекст и читается обратно, флаги доставки пишутся по исходу
// каждого канала, повтор доставки находит недоставленное, ретенция пишет ''
// в шифрованные колонки и читает их обратно, а блок /stats на живой базе
// отдаёт заявки.
//
// Изоляция: фикстуры метятся колонкой `source` (она хранится открыто, имя и
// контакт зашифрованы — по ним искать нельзя). Ретенция и повтор идут с
// «сейчас» в 2001 году, поэтому захватывают только строки с createdAt в 2000-м,
// то есть исключительно фикстуры этого спека.
process.env.ADMIN_ID = '424242';

import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service';
import { IntroLeadService } from '../src/booking/intro-lead.service';
import { IntroLeadRetentionService } from '../src/booking/intro-lead-retention.service';
import { INTRO_LEAD_SCHEMA } from '../src/booking/intro-lead.schema';
import { BookingRetentionMetricsService } from '../src/bot/booking-retention-metrics.service';
import { TELEGRAF_BOT } from '../src/telegram/telegram.constants';
import { decryptRecord, encryptRecord } from '../src/utils/crypto';
import { buildRealDbTestApp } from './e2e-support/build-real-db-test-app';

const MARK = 'e2e-intro-lead/';
const PRACTICE = 'kotlarewski.gr';
const OLD_AT = new Date('2000-01-01T10:00:00.000Z');
const NOW_2001 = new Date('2001-06-15T04:47:00.000Z');

describe('e2e: заявка с формы знакомства пишется в БД до уведомлений', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let sendMessage: jest.Mock;

  const cleanup = async () => {
    await prisma.introLead.deleteMany({
      where: { source: { startsWith: MARK } },
    });
    // Троттл заявки (6/ч на IP) живёт в Postgres и переживает прогон.
    await prisma.throttleHit.deleteMany({});
    await prisma.cronLease.deleteMany({
      where: { name: 'introLeadRedelivery' },
    });
  };

  const post = (body: object) =>
    request(app.getHttpServer())
      .post('/api/booking')
      .set('Host', PRACTICE)
      .send(body);

  const rowBySource = (source: string) =>
    prisma.introLead.findFirstOrThrow({ where: { source } });

  const oldLead = (tag: string, over: object = {}) =>
    prisma.introLead.create({
      data: {
        ...encryptRecord(
          {
            clientName: `Имя ${tag}`,
            clientContact: `contact-${tag}`,
            message: `Запрос ${tag}`,
          },
          INTRO_LEAD_SCHEMA,
        ),
        clientChannel: 'email',
        source: `${MARK}${tag}`,
        createdAt: OLD_AT,
        ...over,
      },
    });

  beforeAll(async () => {
    ({ app, prisma } = await buildRealDbTestApp());
    await cleanup();
    sendMessage = app.get(TELEGRAF_BOT).telegram.sendMessage;
    sendMessage.mockClear();
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('POST с хоста визитки: ответ ok, строка создана, имя/контакт/запрос в БД — шифртекст, читаются обратно', async () => {
    const res = await post({
      name: 'Мария <b>',
      contact: '@maria_e2e',
      channel: 'telegram',
      message: 'Тревожно по вечерам',
      source: `${MARK}happy`,
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });

    const row = await rowBySource(`${MARK}happy`);
    expect(row.clientName).not.toContain('Мария');
    expect(row.clientContact).not.toContain('maria_e2e');
    expect(row.message).not.toContain('Тревожно');
    expect(row.clientChannel).toBe('telegram');
    expect(decryptRecord(row, INTRO_LEAD_SCHEMA)).toMatchObject({
      clientName: 'Мария <b>',
      clientContact: '@maria_e2e',
      message: 'Тревожно по вечерам',
    });
    expect(row.anonymizedAt).toBeNull();
  });

  it('доставка отмечена по факту каждого канала: бот ответил — tgDeliveredAt, ключа Resend нет — emailDeliveredAt пуст', async () => {
    const row = await rowBySource(`${MARK}happy`);
    expect(row.tgDeliveredAt).toBeInstanceOf(Date);
    // В тестовой среде RESEND_API_KEY не задан: письмо не уходит и не должно
    // засчитываться доставленным (раньше send() молча выходил).
    expect(row.emailDeliveredAt).toBeNull();
    const dms = sendMessage.mock.calls.map((c: unknown[]) => String(c[1]));
    expect(dms.some((t) => t.includes('@maria_e2e'))).toBe(true);
    expect(dms.find((t) => t.includes('@maria_e2e'))).toContain(
      'Мария &lt;b&gt;',
    );
  });

  it('неполная заявка: молча ok, строки нет', async () => {
    const res = await post({ name: ' ', contact: '', source: `${MARK}empty` });
    expect(res.status).toBe(200);
    await expect(
      prisma.introLead.count({ where: { source: `${MARK}empty` } }),
    ).resolves.toBe(0);
  });

  it('повтор доставки: находит недоставленную заявку, расшифровывает, шлёт и отмечает; доставленную не трогает', async () => {
    const lost = await oldLead('redeliver');
    const done = await oldLead('delivered', { tgDeliveredAt: OLD_AT });
    sendMessage.mockClear();
    const service = app.get(IntroLeadService);

    // «Сейчас» = час после заявки: окно 5 минут … 7 дней захватывает фикстуры 2000-го.
    const hourLater = new Date(OLD_AT.getTime() + 3_600_000);
    await expect(service.redeliver(hourLater)).resolves.toBe(1);

    const after = await prisma.introLead.findUniqueOrThrow({
      where: { id: lost.id },
    });
    expect(after.deliveryAttempts).toBe(1);
    expect(after.tgDeliveredAt).toBeInstanceOf(Date);
    const dms = sendMessage.mock.calls.map((c: unknown[]) => String(c[1]));
    expect(dms).toHaveLength(1);
    expect(dms[0]).toContain('Повторная отправка');
    expect(dms[0]).toContain('Имя redeliver');

    const untouched = await prisma.introLead.findUniqueOrThrow({
      where: { id: done.id },
    });
    expect(untouched.deliveryAttempts).toBe(0);
  });

  it('/stats на живой базе: блок заявок отдаётся без сырого мусора, недошедшие видны', async () => {
    await oldLead('stats-lost'); // createdAt 2000-й, не доставлена, не обезличена
    const text = await new BookingRetentionMetricsService(prisma).render();
    expect(text).toContain('Заявки с формы знакомства');
    expect(text).toMatch(/За неделю заявок: \d+/);
    expect(text).toMatch(/Недоставленных заявок старше недели: \d+/);
    expect(text).not.toMatch(/NaN|undefined|\[object/);
  });

  it("ретенция: старые фикстуры обезличены ('' читается без исключения), граница и свежая запись не тронуты", async () => {
    const old = await oldLead('old', {
      createdAt: new Date('2000-04-15T10:00:00.000Z'),
    });
    const boundary = await oldLead('boundary', {
      createdAt: new Date('2000-06-15T04:47:00.000Z'), // ровно год до NOW_2001
    });
    const fresh = await rowBySource(`${MARK}happy`); // создана «сегодня»
    const retention = app.get(IntroLeadRetentionService);

    const { anonymized } = await retention.anonymizeOld(NOW_2001);
    expect(anonymized).toBeGreaterThanOrEqual(1);

    const oldAfter = await prisma.introLead.findUniqueOrThrow({
      where: { id: old.id },
    });
    expect(oldAfter.clientName).toBe('');
    expect(oldAfter.clientContact).toBe('');
    expect(oldAfter.message).toBeNull();
    expect(oldAfter.anonymizedAt?.getTime()).toBe(NOW_2001.getTime());
    // Учётный след остаётся.
    expect(oldAfter.clientChannel).toBe('email');
    expect(oldAfter.source).toBe(`${MARK}old`);
    expect(decryptRecord(oldAfter, INTRO_LEAD_SCHEMA)).toMatchObject({
      clientName: '',
      clientContact: '',
      message: null,
    });

    const boundaryAfter = await prisma.introLead.findUniqueOrThrow({
      where: { id: boundary.id },
    });
    expect(boundaryAfter.anonymizedAt).toBeNull();
    expect(decryptRecord(boundaryAfter, INTRO_LEAD_SCHEMA).clientName).toBe(
      'Имя boundary',
    );
    const freshAfter = await prisma.introLead.findUniqueOrThrow({
      where: { id: fresh.id },
    });
    expect(freshAfter.anonymizedAt).toBeNull();
  });

  it('обезличенную заявку повтор доставки не берёт, повторный прогон ретенции идемпотентен', async () => {
    const before = await prisma.introLead.count({
      where: { source: { startsWith: MARK }, anonymizedAt: { not: null } },
    });
    const service = app.get(IntroLeadService);
    await prisma.cronLease.deleteMany({
      where: { name: 'introLeadRedelivery' },
    });
    // Окно повтора от 2000-04-15: обезличенная old (недоставленная) не попадает.
    const sentBefore = sendMessage.mock.calls.length;
    await service.redeliver(new Date('2000-04-15T11:00:00.000Z'));
    const dms = sendMessage.mock.calls
      .slice(sentBefore)
      .map((c: unknown[]) => String(c[1]));
    expect(dms.join('\n')).not.toContain('Имя old');

    await expect(
      app.get(IntroLeadRetentionService).anonymizeOld(NOW_2001),
    ).resolves.toEqual({ anonymized: 0 });
    await expect(
      prisma.introLead.count({
        where: { source: { startsWith: MARK }, anonymizedAt: { not: null } },
      }),
    ).resolves.toBe(before);
  });
});
