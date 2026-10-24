// B1 (аудит 2026-10): карточку сверки в Telegram может подтвердить или
// отклонить только тот, кому её показали. Раньше «Да» нажимал любой, кто
// увидел карточку в группе или пересылке, и отдавал СВОЮ сессию браузеру
// того, кто начал вход (а при link_ — сливал чужую личность со своим
// аккаунтом).
import {
  makeDeps,
  startLogin,
  startLink,
  WEB_USER,
} from './login-ticket.harness.spec';
import { viewerMayAct } from './ticket-viewer';

const OWNER = 111n; // кому показали карточку
const STRANGER = 222n; // кто увидел её в группе / получил пересылкой
const OWNER_CANON = 999n; // канонический id владельца после слияния — не равен сырому

describe('viewerMayAct', () => {
  it('не из Telegram (HTTP/MAX) — проверки нет', () => {
    expect(viewerMayAct(null, undefined)).toBe(true);
    expect(viewerMayAct(OWNER, undefined)).toBe(true);
  });
  it('из Telegram — только тот, кому показали', () => {
    expect(viewerMayAct(OWNER, OWNER)).toBe(true);
    expect(viewerMayAct(OWNER, STRANGER)).toBe(false);
  });
  it('из Telegram по карточке, которую никому не закрепляли, — отказ', () => {
    expect(viewerMayAct(null, OWNER)).toBe(false);
  });
});

describe('LoginTicketService — привязка карточки к тому, кому её показали', () => {
  it('forConfirm закрепляет билет за первым увидевшим', async () => {
    const { tickets, rows } = makeDeps();
    const { userCode } = await startLogin(tickets);
    expect(await tickets.forConfirm(userCode, OWNER)).not.toBeNull();
    expect(rows[0].shownToTelegramId).toBe(OWNER);
    // Тот же человек открывает карточку повторно — по-прежнему его.
    expect(await tickets.forConfirm(userCode, OWNER)).not.toBeNull();
  });

  it('второй увидевший получает «код не найден» и след в аудите', async () => {
    const { tickets, rows, securityLog } = makeDeps();
    const { userCode } = await startLogin(tickets);
    await tickets.forConfirm(userCode, OWNER);
    expect(await tickets.forConfirm(userCode, STRANGER)).toBeNull();
    expect(rows[0].shownToTelegramId).toBe(OWNER);
    expect(securityLog.log).toHaveBeenCalledWith(
      'login_ticket_cross_user',
      expect.objectContaining({ shownTo: OWNER, actor: STRANGER }),
    );
  });

  it('approveLogin: чужое нажатие отклонено и не выдаёт сессию, своё проходит', async () => {
    const { tickets, rows, securityLog } = makeDeps();
    const { userCode } = await startLogin(tickets);
    await tickets.forConfirm(userCode, OWNER);

    await expect(
      tickets.approveLogin(userCode, WEB_USER, STRANGER),
    ).rejects.toThrow('Код не найден');
    expect(rows[0].approvedUserId).toBeNull();
    expect(securityLog.log).toHaveBeenCalledWith(
      'login_ticket_cross_user',
      expect.objectContaining({ shownTo: OWNER, actor: STRANGER }),
    );

    // Сверяется СЫРОЙ id: канонический (после слияния) отличается от него.
    await tickets.approveLogin(userCode, OWNER_CANON, OWNER);
    expect(rows[0].approvedUserId).toBe(OWNER_CANON);
  });

  it('approveLogin из Telegram по карточке, которую никому не закрепляли, — отказ', async () => {
    const { tickets, rows } = makeDeps();
    const { userCode } = await startLogin(tickets);
    await expect(
      tickets.approveLogin(userCode, WEB_USER, STRANGER),
    ).rejects.toThrow('Код не найден');
    expect(rows[0].approvedUserId).toBeNull();
  });

  it('HTTP-подтверждение (проверенная сессия) работает, пока билет не закреплён', async () => {
    const { tickets, rows } = makeDeps();
    const { userCode } = await startLogin(tickets);
    await tickets.approveLogin(userCode, WEB_USER);
    expect(rows[0].approvedUserId).toBe(WEB_USER);
  });

  it('deny: чужое «Это не я» не гасит билет, своё гасит', async () => {
    const { tickets, rows } = makeDeps();
    const { userCode } = await startLogin(tickets);
    await tickets.forConfirm(userCode, OWNER);
    await expect(tickets.deny(userCode, STRANGER)).rejects.toThrow();
    expect(rows[0].deniedAt).toBeNull();
    await tickets.deny(userCode, OWNER);
    expect(rows[0].deniedAt).not.toBeNull();
  });
});

describe('TicketLinkService.approve — привязка к тому, кому показали карточку', () => {
  it('чужое нажатие не запускает merge, своё — запускает', async () => {
    const { tickets, links, merge } = makeDeps();
    const { userCode } = await startLink(tickets);
    await tickets.forConfirm(userCode, OWNER);

    await expect(
      links.approve(userCode, WEB_USER, undefined, STRANGER),
    ).rejects.toThrow('Код не найден');
    expect(merge.merge).not.toHaveBeenCalled();

    await links.approve(userCode, OWNER_CANON, undefined, OWNER);
    expect(merge.merge).toHaveBeenCalledTimes(1);
  });
});

describe('миграция login_ticket_shown_to', () => {
  it('колонка объявлена в schema.prisma и добавлена миграцией (nullable, без backfill)', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path') as typeof import('path');
    const root = path.resolve(__dirname, '../../..');
    const schema = fs.readFileSync(
      path.join(root, 'prisma/schema.prisma'),
      'utf8',
    );
    expect(schema).toMatch(/shownToTelegramId\s+BigInt\?/);
    const dir = fs
      .readdirSync(path.join(root, 'prisma/migrations'))
      .find((d) => d.endsWith('_login_ticket_shown_to'));
    expect(dir).toBeDefined();
    const sql = fs.readFileSync(
      path.join(root, 'prisma/migrations', dir!, 'migration.sql'),
      'utf8',
    );
    expect(sql).toContain(
      'ALTER TABLE "LoginTicket" ADD COLUMN "shownToTelegramId" BIGINT;',
    );
    expect(sql).not.toMatch(/NOT NULL/);
  });
});
