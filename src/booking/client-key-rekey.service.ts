import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { isUniqueViolation } from '../prisma/unique-violation';
import { TelegramService } from '../telegram/telegram.service';
import { decrypt } from '../utils/crypto';
import { clientKey, clientKeySources, isLegacyKey } from './client-key';
import { rekeyReport, type RekeyStats } from './client-key-rekey.report';

// Перевод строк ClientMeeting на ключ client-key.ts (аудит 2026-10). Из ключа
// контакт не восстановить, но он есть в брони (Booking.clientContact,
// зашифрован): по каждой брони с выданной ссылкой («претендент» — её
// подтверждение комнату создало или переиспользовало) считается новый ключ и
// ключи, под которыми строку мог записать прежний код (client-key.ts,
// clientKeySources). Строка под старым ключом переезжает на новый. Претендент
// на строку — только бронь, в которой лежит ссылка ИМЕННО на её комнату:
// HELD-бронь без ссылки (ящик, похожий на ящик клиента) или бронь со ссылкой
// из другой эпохи (статичный MEETING_URL, комната до замены) строку не
// получает и в сообщение владельцу не попадает.
//
// Флага «сделано» нет намеренно, в отличие от волн дошифровки: при
// перекатывающемся деплое старый инстанс пишет строки в старом формате уже
// после прохода нового. Проход идёт на каждом старте; таблица — по строке на
// клиента, повторный проход ничего не меняет.
//
// Склейка: одна старая строка, претенденты с РАЗНЫМИ новыми ключами (ящики
// `ivan-petrov@` и `ivanpetrov@` давали один ключ). Комната остаётся за самой
// ранней бронью — её подтверждение строку и создало; остальные контакты при
// следующей брони получат новую комнату. Брони, где уже лежит ссылка на чужую
// комнату, уходят владельцу одним сообщением на прогон.
//
// Строка старого формата без единого претендента — остаток обезличенных броней
// (ретенция 12 месяцев): по ней дамп отвечал «записывался ли человек». Такие
// строки удаляются; моложе часа — нет (их могло записать подтверждение, ещё
// не дописавшее ссылку в бронь). Строки нового формата без претендентов не
// трогаются: это клиенты, чьи брони уже обезличены.
const BATCH = 500;
const ORPHAN_MIN_AGE_MS = 3_600_000;

interface Claim {
  bookingId: number;
  createdAt: Date;
  target: string;
  /** Расшифрованная ссылка брони — сверяется со ссылкой строки. */
  url: string | null;
}
interface Row {
  clientKey: string;
  meetingUrl: string;
  createdAt: Date;
}

/** Претенденты, в чьих бронях лежит ссылка именно на комнату этой строки. */
function holders(row: Row, claims: Claim[] | undefined): Claim[] {
  if (!claims) return [];
  const url = decrypt(row.meetingUrl);
  return claims.filter((c) => !!c.url && c.url === url);
}

@Injectable()
export class ClientKeyRekeyService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ClientKeyRekeyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegram: TelegramService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    // Ошибка прохода не роняет бут: строка под старым ключом просто не
    // найдётся (клиент получит новую комнату), повтор — на следующем старте.
    await this.run().catch((e: unknown) =>
      this.logger.error(
        `clientKey rekey failed: ${e instanceof Error ? e.message : String(e)}`,
      ),
    );
  }

  async run(now = new Date()): Promise<RekeyStats> {
    const claims = await this.collectClaims();
    const stats: RekeyStats = {
      moved: 0,
      dropped: 0,
      purged: 0,
      shared: [],
      stale: [],
    };
    const rows: Row[] = await this.prisma.clientMeeting.findMany({
      select: { clientKey: true, meetingUrl: true, createdAt: true },
    });
    const cutoff = new Date(now.getTime() - ORPHAN_MIN_AGE_MS);
    const orphans: string[] = [];
    for (const row of rows) {
      const list = holders(row, claims.get(row.clientKey));
      if (list.length > 0) await this.moveRow(row, list, stats);
      else if (isLegacyKey(row.clientKey) && row.createdAt < cutoff)
        orphans.push(row.clientKey);
    }
    if (orphans.length > 0) {
      const res = await this.prisma.clientMeeting.deleteMany({
        where: { clientKey: { in: orphans }, createdAt: { lt: cutoff } },
      });
      stats.purged = res.count;
    }
    if (stats.moved + stats.dropped + stats.purged > 0)
      this.logger.log(
        `clientKey rekey: moved ${stats.moved}, dropped ${stats.dropped}, purged ${stats.purged}`,
      );
    const report = rekeyReport(stats);
    if (report) await this.telegram.notifyAdmin(report);
    return stats;
  }

  private async moveRow(row: Row, list: Claim[], stats: RekeyStats) {
    const sorted = [...list].sort(
      (a, b) =>
        a.createdAt.getTime() - b.createdAt.getTime() ||
        a.bookingId - b.bookingId,
    );
    const target = sorted[0].target;
    const where = { clientKey: row.clientKey, meetingUrl: row.meetingUrl };
    try {
      const res = await this.prisma.clientMeeting.updateMany({
        where,
        data: { clientKey: target },
      });
      if (res.count === 0) return; // строку изменили между чтением и записью — следующий старт
      stats.moved += 1;
      for (const c of sorted)
        if (c.target !== target) stats.shared.push(c.bookingId);
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      // Под новым ключом строка уже есть (клиент записался через новый инстанс
      // в окне деплоя): она остаётся, старая уходит, брони с её ссылкой (list
      // отфильтрован по ссылке строки) — владельцу.
      const res = await this.prisma.clientMeeting.deleteMany({ where });
      stats.dropped += res.count;
      if (res.count > 0) stats.stale.push(...sorted.map((c) => c.bookingId));
    }
  }

  /** Претенденты по ключам, под которыми их строку мог записать прежний код. */
  private async collectClaims(): Promise<Map<string, Claim[]>> {
    const bySource = new Map<string, Claim[]>();
    let after = 0;
    for (;;) {
      const rows = await this.prisma.booking.findMany({
        // anonymizedAt дублирует отсев пустого контакта ниже (крон обезличивания
        // затирает contact в ''), meetingUrl — сверку ссылки в run(): оба
        // фильтра сужают чтение на стороне БД, решение принимается не ими.
        where: {
          id: { gt: after },
          anonymizedAt: null,
          meetingUrl: { not: null },
        },
        orderBy: { id: 'asc' },
        take: BATCH,
        select: {
          id: true,
          createdAt: true,
          clientContact: true,
          meetingUrl: true,
        },
      });
      if (rows.length === 0) return bySource;
      for (const r of rows) {
        const contact = decrypt(r.clientContact);
        if (!contact) continue;
        const claim = {
          bookingId: r.id,
          createdAt: r.createdAt,
          target: clientKey(contact),
          url: decrypt(r.meetingUrl),
        };
        for (const src of clientKeySources(contact))
          bySource.set(src, [...(bySource.get(src) ?? []), claim]);
      }
      after = rows[rows.length - 1].id;
    }
  }
}
