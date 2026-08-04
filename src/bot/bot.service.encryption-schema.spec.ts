// Волна В mutation-покрытия (2026-08): getUserSettings/updateUserSettings
// объявляют EncryptSchema { jsonArrays: ['mySchemaIds', 'myModeIds'] } inline
// в обоих методах — read-after-write тест в bot.service.settings.spec.ts
// проходит даже если Stryker вырежет одно поле из массива, потому что в
// тестах ENCRYPTION_KEY не задан и fake-Prisma хранит значение по ссылке
// (round-trip совпадает без реального шифрования). Здесь мы шпионим за
// реальными encryptRecord/decryptRecord и проверяем ТОЧНУЮ схему, которую
// им передают — только так ловится мутант, укорачивающий jsonArrays.
import * as crypto from '../utils/crypto';
import { BotService } from './bot.service';

describe('BotService — точная EncryptSchema для настроек (mySchemaIds/myModeIds)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('getUserSettings вызывает decryptRecord ровно с jsonArrays: [mySchemaIds, myModeIds]', async () => {
    const spy = jest.spyOn(crypto, 'decryptRecord');
    const db: any = {
      user: {
        findUnique: jest.fn(() => ({ mySchemaIds: null, myModeIds: null })),
      },
    };
    const svc = new BotService(db);

    await svc.getUserSettings(1n);

    expect(spy).toHaveBeenCalledWith(expect.anything(), {
      jsonArrays: ['mySchemaIds', 'myModeIds'],
    });
  });

  it('updateUserSettings вызывает encryptRecord ровно с jsonArrays: [mySchemaIds, myModeIds]', async () => {
    const spy = jest.spyOn(crypto, 'encryptRecord');
    const db: any = { user: { update: jest.fn(() => Promise.resolve({})) } };
    const svc = new BotService(db);

    await svc.updateUserSettings(1n, { mySchemaIds: ['defectiveness'] });

    expect(spy).toHaveBeenCalledWith(
      { mySchemaIds: ['defectiveness'] },
      { jsonArrays: ['mySchemaIds', 'myModeIds'] },
    );
  });
});
