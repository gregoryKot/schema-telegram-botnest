// Адрес возврата с OAuth-площадки (правило №6): строки с верхней границей,
// все параметры необязательные, незнакомый параметр вход не ломает. Проверяем
// теми же настройками, что у глобального ValidationPipe (configure-app.ts):
// whitelist есть, forbidNonWhitelisted — нет. Образец запроса — записанный
// возврат Яндекса (test/fixtures/recorded/yandex-id-oauth.json).
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { loadRecordedFixture } from '../../test-support/recorded-fixture';
import { OAuthCallbackQueryDto } from './oauth-callback.dto';

const rec = JSON.parse(loadRecordedFixture('yandex-id-oauth.json')) as {
  callback: { query: Record<string, string>; cidLength: number };
};

async function check(query: Record<string, unknown>) {
  const dto = plainToInstance(OAuthCallbackQueryDto, query);
  const errors = await validate(dto, { whitelist: true });
  return { dto, bad: errors.map((e) => e.property) };
}

describe('OAuthCallbackQueryDto', () => {
  it('записанный возврат Яндекса (state, code, cid) проходит целиком', async () => {
    const query = {
      ...rec.callback.query,
      cid: 'c'.repeat(rec.callback.cidLength),
    };
    const { dto, bad } = await check(query);
    expect(bad).toEqual([]);
    expect(dto).toEqual(query);
  });

  it('отказ площадки (error + error_description) проходит', async () => {
    const { bad } = await check({
      error: 'access_denied',
      error_description: 'User denied access',
      state: 'a.b.c',
    });
    expect(bad).toEqual([]);
  });

  it('пустой запрос — не ошибка формы: решает общий хвост колбэка', async () => {
    expect((await check({})).bad).toEqual([]);
  });

  it('незнакомый параметр срезается, а не роняет вход', async () => {
    const { dto, bad } = await check({ code: 'c', state: 's', scope: 'x' });
    expect(bad).toEqual([]);
    expect(dto).toEqual({ code: 'c', state: 's' });
  });

  it.each([
    ['code', 512],
    ['state', 1024],
    ['error', 128],
    ['error_description', 2048],
    ['cid', 256],
  ])('%s: до %d символов — проходит, длиннее — отказ', async (field, max) => {
    expect((await check({ [field]: 'x'.repeat(max) })).bad).toEqual([]);
    expect((await check({ [field]: 'x'.repeat(max + 1) })).bad).toEqual([
      field,
    ]);
  });

  it.each(['code', 'state', 'error', 'error_description', 'cid'])(
    '%s: повторённый параметр (массив) и объект — отказ, а не строка',
    async (field) => {
      expect((await check({ [field]: ['a', 'b'] })).bad).toEqual([field]);
      expect((await check({ [field]: { $gt: '' } })).bad).toEqual([field]);
    },
  );
});
