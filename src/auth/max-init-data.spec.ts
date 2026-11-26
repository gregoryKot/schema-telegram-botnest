// Верификация подписи мини-аппа MAX (dev.max.ru/docs/webapps/validation).
// Регрессия здесь = обход входа в MAX-мини-апп (те же данные, что и у
// Telegram мини-аппа, см. CLAUDE.md «Два фронтенда — один бэк»).
//
// Подпись в тесте собирается САМОСТОЯТЕЛЬНО по алгоритму спеки (не через
// verifyMaxInitData), чтобы тест был честной проверкой, а не подгонкой.
import { createHmac } from 'crypto';
import { MaxNotConfiguredError, verifyMaxInitData } from './max-init-data';

const BOT_TOKEN = '999888:MAX_TEST_TOKEN';

interface SignOpts {
  user?: unknown;
  authDate?: number;
  botToken?: string;
  extraFields?: Record<string, string>;
  now?: number;
}

// Собирает и подписывает initData точно по спеке MAX: пары key=value
// (значения URL-кодируются через encodeURIComponent), hash считается по
// отсортированным парам (без hash), склеенным через '\n'.
function signInitData(opts: SignOpts = {}): string {
  const fields: Record<string, string> = {
    auth_date: String(
      opts.authDate ?? Math.floor((opts.now ?? Date.now()) / 1000),
    ),
    query_id: '4c0ab423-test',
    ...opts.extraFields,
  };
  if (opts.user !== undefined) fields.user = JSON.stringify(opts.user);

  const checkString = Object.keys(fields)
    .sort((a, b) => a.localeCompare(b))
    .map((k) => `${k}=${fields[k]}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData')
    .update(opts.botToken ?? BOT_TOKEN)
    .digest();
  const hash = createHmac('sha256', secret).update(checkString).digest('hex');

  const pairs = Object.entries(fields).map(
    ([k, v]) => `${k}=${encodeURIComponent(v)}`,
  );
  pairs.push(`hash=${hash}`);
  return pairs.join('&');
}

const USER = { id: 67890, first_name: 'Оля', username: 'olya_max' };

describe('verifyMaxInitData', () => {
  it('валидная подпись → id строкой, firstName, username', () => {
    const initData = signInitData({ user: USER });
    const result = verifyMaxInitData(initData, BOT_TOKEN);
    expect(result).toEqual({
      id: '67890',
      firstName: 'Оля',
      username: 'olya_max',
    });
  });

  it('подделка: значение поля изменено после подписи → ошибка', () => {
    const initData = signInitData({ user: USER });
    const tampered = initData.replace(
      'query_id=4c0ab423-test',
      'query_id=evil',
    );
    expect(() => verifyMaxInitData(tampered, BOT_TOKEN)).toThrow(
      'Invalid MAX initData signature',
    );
  });

  it('чужой токен бота → ошибка', () => {
    const initData = signInitData({ user: USER, botToken: 'attacker-token' });
    expect(() => verifyMaxInitData(initData, BOT_TOKEN)).toThrow(
      'Invalid MAX initData signature',
    );
  });

  it('hash отсутствует → ошибка', () => {
    const initData = signInitData({ user: USER })
      .split('&')
      .filter((p) => !p.startsWith('hash='))
      .join('&');
    expect(() => verifyMaxInitData(initData, BOT_TOKEN)).toThrow(
      'Missing hash in initData',
    );
  });

  it('hash встречается два раза → ошибка (требование спеки MAX)', () => {
    const initData = signInitData({ user: USER });
    const duplicated = `${initData}&hash=${'0'.repeat(64)}`;
    expect(() => verifyMaxInitData(duplicated, BOT_TOKEN)).toThrow(
      'Missing hash in initData',
    );
  });

  it('hash не 64 hex-символа (короткий) → ошибка, не RangeError', () => {
    const initData = signInitData({ user: USER }).replace(
      /hash=[0-9a-f]+$/,
      'hash=abc',
    );
    expect(() => verifyMaxInitData(initData, BOT_TOKEN)).toThrow(
      'Malformed hash in initData',
    );
  });

  it('hash не hex (мусор) → ошибка, не RangeError', () => {
    const initData = signInitData({ user: USER }).replace(
      /hash=[0-9a-f]+$/,
      `hash=${'z'.repeat(64)}`,
    );
    expect(() => verifyMaxInitData(initData, BOT_TOKEN)).toThrow(
      'Malformed hash in initData',
    );
  });

  it('auth_date старше часа → ошибка, начинающаяся с "init data expired"', () => {
    const initData = signInitData({
      user: USER,
      authDate: Math.floor(Date.now() / 1000) - 3700,
    });
    // Assert на точный префикс важен: classifyInitDataFailure
    // (src/api/initdata-alert.ts) отличает просрочку от подделки регуляркой
    // /^init data expired/i — просрочка не должна будить админа алертом.
    let message = '';
    try {
      verifyMaxInitData(initData, BOT_TOKEN);
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/^init data expired/i);
  });

  it('auth_date в пределах часа → успех', () => {
    const initData = signInitData({
      user: USER,
      authDate: Math.floor(Date.now() / 1000) - 1800,
    });
    expect(() => verifyMaxInitData(initData, BOT_TOKEN)).not.toThrow();
  });

  // Регрессия: URLSearchParams превращает буквальный '+' в пробел при
  // разборе, а MAX ожидает decodeURIComponent — '+' должен остаться '+'.
  // Если бы разбор шёл через URLSearchParams, подпись не сошлась бы.
  it('значение с литеральным + внутри проверяется корректно (не URLSearchParams)', () => {
    const userWithPlus = { id: 111, first_name: 'A+B Co' };
    const initData = signInitData({ user: userWithPlus });
    const result = verifyMaxInitData(initData, BOT_TOKEN);
    expect(result.firstName).toBe('A+B Co');
  });

  it('поле user отсутствует → ошибка', () => {
    const initData = signInitData({});
    expect(() => verifyMaxInitData(initData, BOT_TOKEN)).toThrow(
      'Missing user in initData',
    );
  });

  it('user.id не число → ошибка', () => {
    const initData = signInitData({ user: { id: 'not-a-number' } });
    expect(() => verifyMaxInitData(initData, BOT_TOKEN)).toThrow(
      'Missing user id in initData',
    );
  });

  it('порядок пар в строке не важен — подпись считается по отсортированным ключам', () => {
    const initData = signInitData({ user: USER });
    const reordered = initData.split('&').reverse().join('&');
    const result = verifyMaxInitData(reordered, BOT_TOKEN);
    expect(result.id).toBe('67890');
  });

  // Диагностика в сообщении об ошибке. «Подпись неверна» одинаково выглядит и
  // когда токен от другого бота, и когда площадка прислала строку в другом
  // виде — форма строки различает эти случаи. Наружу уходит ТОЛЬКО структура:
  // сообщение попадает в аудит-лог и в DM админу, значениям там не место.
  describe('форма строки в сообщении о несовпавшей подписи', () => {
    it('перечисляет поля и не содержит ни одного значения', () => {
      const initData = signInitData({
        authDate: 1700000000,
        user: { id: 42, first_name: 'Ира' },
        botToken: 'чужой-токен',
      });
      let message = '';
      try {
        verifyMaxInitData(initData, BOT_TOKEN, { now: 1700000000_000 });
      } catch (err) {
        message = (err as Error).message;
      }
      expect(message).toContain('поля: auth_date,query_id,user');
      // Ни имени, ни идентификатора, ни JSON значения быть не должно.
      expect(message).not.toContain('Ира');
      expect(message).not.toContain('42');
      expect(message).not.toContain('{');
    });

    it('отмечает, что значения остались процент-кодированными', () => {
      // Ровно тот случай, который мы подозреваем: лишний слой кодирования.
      const raw = 'auth_date=1700000000&user=%257B%2522id%2522%253A42%257D';
      const withHash = `${raw}&hash=${'0'.repeat(64)}`;
      let message = '';
      try {
        verifyMaxInitData(withHash, BOT_TOKEN, { now: 1700000000_000 });
      } catch (err) {
        message = (err as Error).message;
      }
      expect(message).toContain('значения ещё кодированы: да');
    });

    it('при нормальной строке отмечает, что кодирования не осталось', () => {
      const initData = signInitData({
        authDate: 1700000000,
        user: { id: 42 },
        botToken: 'чужой-токен',
      });
      let message = '';
      try {
        verifyMaxInitData(initData, BOT_TOKEN, { now: 1700000000_000 });
      } catch (err) {
        message = (err as Error).message;
      }
      expect(message).toContain('значения ещё кодированы: нет');
    });
  });
});

// Ночной мутационный замер (stryker.golden-auth.config.json): разбор строки,
// граница срока и форма сообщения, которых прежние тесты не различали.
describe('verifyMaxInitData — разбор и границы под мутационным замером', () => {
  const NOW = 1_700_000_000_000;
  const NOW_S = NOW / 1000;

  /** Пары в заданном порядке; подпись — по отсортированным ключам, как у MAX. */
  function signPairs(pairs: [string, string][], token = BOT_TOKEN): string {
    const checkString = [...pairs]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    const secret = createHmac('sha256', 'WebAppData').update(token).digest();
    const hash = createHmac('sha256', secret).update(checkString).digest('hex');
    return [...pairs.map(([k, v]) => `${k}=${encodeURIComponent(v)}`)]
      .concat(`hash=${hash}`)
      .join('&');
  }
  const userPair: [string, string] = ['user', JSON.stringify({ id: 7 })];
  const failMessage = (initData: string): string => {
    try {
      verifyMaxInitData(initData, BOT_TOKEN, { now: NOW });
    } catch (err) {
      return (err as Error).message;
    }
    return '';
  };

  it('MaxNotConfiguredError — своё имя и текст', () => {
    const err = new MaxNotConfiguredError();
    expect(err.name).toBe('MaxNotConfiguredError');
    expect(err.message).toBe('MAX_BOT_TOKEN not configured');
  });

  it('ключ без «=» — поле с пустым значением, подпись сходится', () => {
    const signed = signPairs([
      ['auth_date', String(NOW_S)],
      ['flag', ''],
      userPair,
    ]);
    const bare = signed.replace('flag=&', 'flag&');
    expect(bare).toContain('&flag&');
    expect(verifyMaxInitData(bare, BOT_TOKEN, { now: NOW }).id).toBe('7');
  });

  it('пустые пары («&&», хвостовой «&») пропускаются, а не становятся полем', () => {
    const signed = signPairs([['auth_date', String(NOW_S)], userPair]);
    expect(
      verifyMaxInitData(`&${signed.replace('&', '&&')}&`, BOT_TOKEN, {
        now: NOW,
      }).id,
    ).toBe('7');
  });

  it('битое процент-кодирование — своя ошибка, а не URIError', () => {
    expect(failMessage(`auth_date=%E0%A4%A&hash=${'0'.repeat(64)}`)).toBe(
      'Malformed initData encoding',
    );
  });

  it('auth_date не первым полем — срок считается по нему, а не по первому', () => {
    const initData = signPairs([
      ['query_id', '4c0ab423-test'],
      ['auth_date', String(NOW_S)],
      userPair,
    ]);
    expect(verifyMaxInitData(initData, BOT_TOKEN, { now: NOW }).id).toBe('7');
  });

  it('без auth_date — просрочено (дата 0), а не принято', () => {
    expect(failMessage(signPairs([userPair]))).toBe('init data expired');
  });

  it('ровно час — ещё принято, на секунду старше — просрочено', () => {
    const at = (s: number) => signPairs([['auth_date', String(s)], userPair]);
    expect(
      verifyMaxInitData(at(NOW_S - 3600), BOT_TOKEN, { now: NOW }).id,
    ).toBe('7');
    expect(failMessage(at(NOW_S - 3601))).toBe('init data expired');
  });

  it('user не JSON — своя ошибка', () => {
    expect(
      failMessage(
        signPairs([
          ['auth_date', String(NOW_S)],
          ['user', '{oops'],
        ]),
      ),
    ).toBe('Invalid user JSON in initData');
  });

  it('first_name и username не строкой отбрасываются', () => {
    const initData = signPairs([
      ['auth_date', String(NOW_S)],
      ['user', JSON.stringify({ id: 7, first_name: 9, username: false })],
    ]);
    expect(verifyMaxInitData(initData, BOT_TOKEN, { now: NOW })).toEqual({
      id: '7',
      firstName: undefined,
      username: undefined,
    });
  });

  describe('форма строки в сообщении', () => {
    const forged = (pairs: [string, string][]) =>
      failMessage(signPairs(pairs, 'чужой-токен'));

    it('имена полей отсортированы, даже если пришли вразнобой', () => {
      expect(
        forged([userPair, ['query_id', 'q'], ['auth_date', String(NOW_S)]]),
      ).toContain('поля: auth_date,query_id,user;');
    });

    it('ни одного поля, кроме hash, — прочерк', () => {
      expect(failMessage(`hash=${'0'.repeat(64)}`)).toContain('поля: —;');
    });

    it('«%» с одним hex-символом — не остаток кодирования', () => {
      expect(
        forged([
          ['auth_date', String(NOW_S)],
          ['note', '%Az'],
        ]),
      ).toContain('значения ещё кодированы: нет');
    });
  });
});
