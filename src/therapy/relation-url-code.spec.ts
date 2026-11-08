// docs/open/therapy.md (аудит 2026-11): urlCode связи ставит Postgres
// случайным DEFAULT, и совпадение с чужим кодом роняло создание приглашения
// 23505 без повтора. Повтор — только для конфликта по urlCode.
import { URL_CODE_ATTEMPTS, insertRelation } from './relation-url-code';

const collision = (index: string) =>
  Object.assign(new Error('Unique constraint failed'), {
    code: 'P2002',
    meta: { driverAdapterError: { cause: { constraint: { index } } } },
  });
const urlCodeTaken = () => collision('TherapyRelation_urlCode_key');

describe('insertRelation — повтор вставки при коллизии urlCode', () => {
  it('коллизия urlCode — вставка повторяется и проходит', async () => {
    const insert = jest
      .fn()
      .mockRejectedValueOnce(urlCodeTaken())
      .mockResolvedValueOnce({ id: 7 });
    await expect(insertRelation(insert)).resolves.toEqual({ id: 7 });
    expect(insert).toHaveBeenCalledTimes(2);
  });

  it(`сдаётся после ${URL_CODE_ATTEMPTS} попыток и отдаёт ошибку`, async () => {
    const insert = jest.fn().mockRejectedValue(urlCodeTaken());
    await expect(insertRelation(insert)).rejects.toMatchObject({
      code: 'P2002',
    });
    expect(insert).toHaveBeenCalledTimes(URL_CODE_ATTEMPTS);
  });

  it.each([
    ['дубль code', collision('TherapyRelation_code_key')],
    ['активная пара', collision('TherapyRelation_active_pair_key')],
    ['не уникальность', new Error('db down')],
  ])('%s — без повтора', async (_n, err) => {
    const insert = jest.fn().mockRejectedValue(err);
    await expect(insertRelation(insert)).rejects.toBe(err);
    expect(insert).toHaveBeenCalledTimes(1);
  });
});
