// Право на переносимость данных (152-ФЗ / GDPR art.15,20). Пара к
// account.delete.ts (right-to-erasure) — тот же контур по userId
// (src/bot/user-data-tables.ts), но с другим решением на каждую таблицу:
// src/account/export-policy.ts (что отдаём, что withhold и почему).
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { SecurityLogService } from '../auth/security-log.service';
import { decryptRecord } from '../utils/crypto';
import {
  EXPORT_POLICY,
  USER_EXPORT_SELECT,
  WITHHELD_USER_FIELDS,
  assertSyncedWithEncryptionPolicy,
} from './export-policy';

export interface DataExportResult {
  exportedAt: string;
  account: Record<string, unknown> | null;
  providers: Record<string, unknown>[];
  data: Record<string, unknown[]>;
  withheld: { table: string; reason: string }[];
}

type Row = Record<string, unknown>;
type FindManyDelegate = {
  findMany(args: { where: { userId: bigint } }): Prisma.PrismaPromise<Row[]>;
};

const WITHHELD_USER_SECRETS = {
  table: Object.keys(WITHHELD_USER_FIELDS)
    .map((f) => `User.${f}`)
    .join(', '),
  reason: Object.entries(WITHHELD_USER_FIELDS)
    .map(([f, why]) => `${f} — ${why}`)
    .join('; '),
};
const WITHHELD_OUT_OF_CONTOUR = {
  table: 'Booking, Donation, ClientMeeting',
  reason:
    'связи с User нет (формы публичные, без входа) — сопоставление по email/' +
    'контакту недостоверно: указавший чужой адрес получил бы чужую запись со ' +
    'свободным текстом. Доступны только ручным запросом администратору',
};
// Аудит 2026-10 (D2): модели терапевтической стороны хранят данные О человеке
// (клиент), но принадлежат другому человеку (терапевт) или связывают двоих —
// у них нет userId, поэтому в EXPORT_POLICY их нет. Раньше файл молчал об этом
// и выглядел полным; теперь человек видит, чего в нём нет и почему.
const WITHHELD_THERAPY_SIDE = {
  table: 'TherapistNote, ClientConceptualization, ModeMap, TherapyRelation',
  reason:
    'записи психолога о вас (заметки, концептуализация, карты режимов, связь ' +
    'с психологом) — это рабочие материалы специалиста; решение об их выдаче ' +
    'принимает владелец проекта по отдельному запросу',
};
const WITHHELD_PAIR = {
  table: 'Pair',
  reason:
    'связи с другими людьми (пара с другом) содержат данные второго человека, ' +
    'без его согласия они в ваш файл не попадают',
};

@Injectable()
export class DataExportService {
  private readonly logger = new Logger(DataExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
    private readonly securityLog: SecurityLogService,
  ) {}

  async buildExport(userId: bigint): Promise<DataExportResult> {
    // Лучше отказать в выгрузке, чем отдать человеку файл, где вместо
    // дневника лежит нерасшифрованная строка, похожая на данные.
    assertSyncedWithEncryptionPolicy();
    const account = await this.loadAccount(userId);
    const providers = await this.prisma.authProvider.findMany({
      where: { userId },
      select: {
        provider: true,
        providerId: true,
        email: true,
        displayName: true,
        createdAt: true,
      },
    });

    const data: Record<string, unknown[]> = {};
    const withheld: { table: string; reason: string }[] = [
      WITHHELD_USER_SECRETS,
      WITHHELD_OUT_OF_CONTOUR,
      WITHHELD_THERAPY_SIDE,
      WITHHELD_PAIR,
    ];

    for (const [model, decision] of Object.entries(EXPORT_POLICY)) {
      // AuthProvider уходит в `providers` отдельным полем — понятнее, чем
      // безымянная таблица среди дневников и оценок.
      if (model === 'AuthProvider') continue;
      if (decision.status === 'withhold') {
        withheld.push({ table: model, reason: decision.reason });
        continue;
      }
      const delegateName = model[0].toLowerCase() + model.slice(1);
      // Индексируем через Record, а не keyof PrismaService: тот союз включает
      // методы клиента ($connect и др.), и typescript-eslint ≥ 8.70 считает
      // такое обращение «отвязанным методом» (unbound-method, PR #485).
      const delegate = (
        this.prisma as unknown as Record<string, FindManyDelegate>
      )[delegateName];
      const rows = await delegate.findMany({ where: { userId } });
      const schema = decision.schema;
      data[model] = schema ? rows.map((r) => decryptRecord(r, schema)) : rows;
    }

    let rows = providers.length;
    for (const tableRows of Object.values(data)) rows += tableRows.length;
    // Аналитика — правило №8 CLAUDE.md. track() сам глотает ошибки БД и не
    // бросает, поэтому await здесь не рискует уронить готовую выгрузку.
    await this.analytics.track(userId, 'data_export', {
      tables: Object.keys(data).length + 1, // +providers
      rows,
    });
    // M7 (аудит 2026-10): выгрузка всех данных — самое чувствительное чтение
    // в продукте (угнанная сессия забирает дневники одним запросом). Аналитика
    // — про воронку, не аудит; след для расследования пишется сюда. Только
    // userId, без содержимого. В DM админу не уходит (не ALERT_EVENTS) —
    // законная выгрузка не повод будить, но в логах она видна.
    this.securityLog.log('data_exported', { userId });
    this.logger.log(`data export: userId=${userId} rows=${rows}`);

    return {
      exportedAt: new Date().toISOString(),
      account,
      providers,
      data,
      withheld,
    };
  }

  private async loadAccount(userId: bigint): Promise<Row | null> {
    const row = await this.prisma.user.findUnique({
      where: { id: userId },
      select: USER_EXPORT_SELECT,
    });
    if (!row) return null;
    // mySchemaIds/myModeIds — зашифрованный JSON-массив (FIELD_POLICY, User),
    // тот же decrypt-приём, что и в bot.service.ts getUserSettings.
    return decryptRecord(row as Row, {
      jsonArrays: ['mySchemaIds', 'myModeIds'],
    });
  }
}
