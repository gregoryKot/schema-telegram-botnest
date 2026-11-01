// POST /api/settings поверх нечитаемых mySchemaIds/myModeIds (остаток после
// D-8, проба encryptionReadable): нечитаемый список уходит клиенту как `[]`,
// клиент присылает свой список целиком — без защиты запись стирала живой
// шифротекст навсегда. Теперь 409 и в БД ничего не меняется.
import { readFileSync } from 'fs';
import { join } from 'path';
import { ConflictException, Logger } from '@nestjs/common';
import { BotService } from './bot.service';
import { UNWRITABLE_REASON } from '../utils/crypto-record';

// Шифротекст под чужим ключом: по форме — шифр, расшифровать нельзя.
const FOREIGN = Buffer.alloc(48, 7).toString('base64');

function makeDb(userRow: Record<string, unknown>) {
  const user: Record<string, unknown> = { ...userRow };
  const db: any = {
    user: {
      findUnique: jest.fn(() => Promise.resolve({ ...user })),
      update: jest.fn(({ data }: any) => {
        Object.assign(user, data);
        return Promise.resolve({ ...user });
      }),
    },
  };
  return { db, user };
}

describe('BotService.updateUserSettings — запись поверх нечитаемых списков', () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('нечитаемый mySchemaIds + запись mySchemaIds → 409 с reason, в БД ничего не изменилось', async () => {
    const { db, user } = makeDb({ mySchemaIds: FOREIGN, myModeIds: '[]' });
    const svc = new BotService(db);

    const err: unknown = await svc
      .updateUserSettings(7n, { mySchemaIds: ['abandonment'] })
      .catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ConflictException);
    expect((err as ConflictException).getResponse()).toEqual({
      message:
        'Правка не сохранена: записанные данные сейчас не читаются, и новая ' +
        'запись стёрла бы их. Нужна помощь владельца проекта.',
      reason: UNWRITABLE_REASON,
    });
    expect(UNWRITABLE_REASON).toBe('unreadable_data');
    expect(db.user.update).not.toHaveBeenCalled();
    expect(user.mySchemaIds).toBe(FOREIGN);
    expect(String(warn.mock.calls[0]?.[0])).toContain('settings user#7');
  });

  it('нечитаемый myModeIds + запись myModeIds вместе с другими полями → 409, не пишется ничего', async () => {
    const { db, user } = makeDb({ mySchemaIds: '[]', myModeIds: FOREIGN });
    const svc = new BotService(db);

    await expect(
      svc.updateUserSettings(7n, {
        myModeIds: ['vulnerable_child'],
        notifyEnabled: false,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(db.user.update).not.toHaveBeenCalled();
    expect(user.myModeIds).toBe(FOREIGN);
    expect(user.notifyEnabled).toBeUndefined();
  });

  it('читаемый список → записалось и читается назад', async () => {
    const { db } = makeDb({ mySchemaIds: '["mistrust"]', myModeIds: '[]' });
    const svc = new BotService(db);

    await svc.updateUserSettings(7n, { mySchemaIds: ['abandonment'] });

    expect(db.user.update).toHaveBeenCalledTimes(1);
    const settings = await svc.getUserSettings(7n);
    expect(settings?.mySchemaIds).toEqual(['abandonment']);
  });

  it('контроль: нечитаемый myModeIds не мешает записи mySchemaIds — и сам не трогается', async () => {
    const { db, user } = makeDb({ mySchemaIds: '[]', myModeIds: FOREIGN });
    const svc = new BotService(db);

    await svc.updateUserSettings(7n, { mySchemaIds: ['abandonment'] });

    expect(db.user.update).toHaveBeenCalledTimes(1);
    expect(user.myModeIds).toBe(FOREIGN);
  });

  it('контроль: правка без списков не читает строку и пишет поверх нечитаемого как раньше', async () => {
    const { db } = makeDb({ mySchemaIds: FOREIGN, myModeIds: FOREIGN });
    const svc = new BotService(db);

    await svc.updateUserSettings(7n, { notifyEnabled: false });

    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 7n },
      data: { notifyEnabled: false },
    });
  });

  it('пустой список поверх нечитаемого — тоже перезапись целиком → 409', async () => {
    const { db } = makeDb({ mySchemaIds: FOREIGN, myModeIds: '[]' });
    const svc = new BotService(db);

    await expect(
      svc.updateUserSettings(7n, { mySchemaIds: [] }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(db.user.update).not.toHaveBeenCalled();
  });
});

// Правило №4: фронтенды узнают отказ по коду из shared/src/api/unwritableError.ts.
describe('UNWRITABLE_REASON совпадает со shared', () => {
  it('тот же машинный код в shared/src/api/unwritableError.ts', () => {
    const shared = readFileSync(
      join(__dirname, '..', '..', 'shared', 'src', 'api', 'unwritableError.ts'),
      'utf8',
    );
    expect(shared).toContain(`UNWRITABLE_REASON = '${UNWRITABLE_REASON}';`);
  });
});
