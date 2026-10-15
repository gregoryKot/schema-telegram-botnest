import {
  BLOCK_FAILED_MARK,
  failedBlockLine,
  settleBlocks,
} from './stats-settle';

describe('failedBlockLine', () => {
  it('имя блока и короткая причина простым языком', () => {
    const line = failedBlockLine('Деньги', new Error('pool timeout'));
    expect(line).toBe(
      `⚠️ <b>«Деньги»</b>: ${BLOCK_FAILED_MARK} — pool timeout`,
    );
  });

  it('пустая причина: строка без «: undefined» и хвоста', () => {
    for (const reason of [undefined, null, '', new Error(''), '   \n  ']) {
      const line = failedBlockLine('Игра', reason);
      expect(line).toBe(`⚠️ <b>«Игра»</b>: ${BLOCK_FAILED_MARK}`);
    }
  });

  it('не-Error причина (строка, объект) не даёт [object Object]', () => {
    expect(failedBlockLine('Игра', 'сбой связи')).toContain('сбой связи');
    expect(failedBlockLine('Игра', { code: 1 })).toBe(
      `⚠️ <b>«Игра»</b>: ${BLOCK_FAILED_MARK}`,
    );
  });

  it('берёт только первую строку, стек не уезжает в отчёт', () => {
    const line = failedBlockLine('Игра', new Error('первая\nвторая\nтретья'));
    expect(line).toContain('первая');
    expect(line).not.toContain('вторая');
  });

  it('у Prisma пропускает служебную «invocation:» и берёт суть', () => {
    const msg =
      '\nInvalid `prisma.user.count()` invocation:\n\n\nrelation "User" does not exist';
    const line = failedBlockLine('Игра', new Error(msg));
    expect(line).toContain('relation "User" does not exist');
    expect(line).not.toContain('invocation');
  });

  it('экранирует HTML: <…> из текста ошибки не ломает parse_mode', () => {
    const line = failedBlockLine('A<b>', new Error('pool <timeout> & co'));
    expect(line).toContain('pool &lt;timeout&gt; &amp; co');
    expect(line).toContain('«A&lt;b&gt;»');
    expect(line.replace(/<\/?b>/g, '')).not.toMatch(/[<>]/);
  });

  it('длинная причина режется до лимита с многоточием', () => {
    const line = failedBlockLine('Игра', new Error('x'.repeat(500)));
    expect(line.endsWith(`${'x'.repeat(100)}…`)).toBe(true);
  });

  it('обрезка идёт до экранирования: HTML-сущность не рвётся', () => {
    // 99 символов + «<»: после экранирования «<» станет &lt; (4 символа).
    const line = failedBlockLine('Игра', new Error(`${'x'.repeat(99)}<tail`));
    expect(line).toContain(`${'x'.repeat(99)}&lt;…`);
    expect(line).not.toMatch(/&l?t?…|&[a-z]*$/);
  });
});

describe('settleBlocks', () => {
  const makeLogger = () => ({ warn: jest.fn() });

  it('порядок сохраняется, упавший блок заменяется заглушкой', async () => {
    const logger = makeLogger();
    const out = await settleBlocks(
      [
        { name: 'A', run: () => 'a' },
        { name: 'B', run: () => Promise.reject(new Error('boom')) },
        { name: 'C', run: async () => 'c' },
      ],
      logger,
    );
    expect(out[0]).toBe('a');
    expect(out[1]).toContain('«B»');
    expect(out[1]).toContain(BLOCK_FAILED_MARK);
    expect(out[1]).toContain('boom');
    expect(out[2]).toBe('c');
    expect(out).toHaveLength(3);
  });

  it('синхронный throw тоже становится заглушкой, а не падением', async () => {
    const out = await settleBlocks(
      [
        {
          name: 'S',
          run: () => {
            throw new Error('sync');
          },
        },
        { name: 'T', run: () => 't' },
      ],
      makeLogger(),
    );
    expect(out[0]).toContain('sync');
    expect(out[1]).toBe('t');
  });

  it('падение логируется warn-ом с именем блока и причиной', async () => {
    const logger = makeLogger();
    await settleBlocks(
      [{ name: 'Деньги', run: () => Promise.reject(new Error('db down')) }],
      logger,
    );
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      'stats block "Деньги" failed: db down',
    );
  });

  it('без падений логгер молчит; пустой список даёт пустой результат', async () => {
    const logger = makeLogger();
    expect(await settleBlocks([], logger)).toEqual([]);
    expect(await settleBlocks([{ name: 'A', run: () => 'a' }], logger)).toEqual(
      ['a'],
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
