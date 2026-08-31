// Резка длинного текста под лимит Telegram.
//
// Главное, что держится тестами: оборванный HTML-тег. Telegram отвергает
// сообщение с незакрытым `<b>` целиком (400 на parse_mode) — то есть кривая
// резка не «портит вид», а роняет весь отчёт, ровно как это делало
// переполнение до сплиттера.
import { splitForTelegram, replyLong, TELEGRAM_LIMIT } from './send-long-text';

const line = (n: number, ch = 'а') => ch.repeat(n);

describe('splitForTelegram', () => {
  it('короткий текст остаётся одним сообщением', () => {
    expect(splitForTelegram('Отчёт')).toEqual(['Отчёт']);
  });

  it('текст ровно по границе не режется', () => {
    const text = line(TELEGRAM_LIMIT);
    expect(splitForTelegram(text)).toHaveLength(1);
  });

  it('режет по границам блоков, а не посреди блока', () => {
    const blocks = [line(60), line(60), line(60)];
    const parts = splitForTelegram(blocks.join('\n\n'), 130);
    expect(parts).toEqual([`${blocks[0]}\n\n${blocks[1]}`, blocks[2]]);
  });

  it('ни один кусок не превышает лимит', () => {
    const text = Array.from(
      { length: 40 },
      (_, i) => `Блок ${i}\n${line(90)}`,
    ).join('\n\n');
    for (const part of splitForTelegram(text, 300)) {
      expect(part.length).toBeLessThanOrEqual(300);
    }
  });

  it('текст сохраняется целиком — разделители не съедаются', () => {
    const text = ['раз', 'два', 'три']
      .map((w) => `${w} ${line(50)}`)
      .join('\n\n');
    const parts = splitForTelegram(text, 80);
    expect(parts.join('\n\n')).toBe(text);
  });

  it('блок длиннее лимита режется по строкам', () => {
    const block = [line(50, 'а'), line(50, 'б'), line(50, 'в')].join('\n');
    const parts = splitForTelegram(block, 110);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toBe(`${line(50, 'а')}\n${line(50, 'б')}`);
  });

  it('неделимая строка режется по символам, но не внутри тега', () => {
    // Граница приходится на середину `<b>` — режем перед тегом, иначе
    // Telegram ответит 400 и человек не увидит отчёт вовсе.
    const text = `${line(18)}<b>${line(40)}</b>`;
    const parts = splitForTelegram(text, 20);
    for (const part of parts) {
      expect(part.split('<').length).toBe(part.split('>').length);
    }
    expect(parts[0]).toBe(line(18));
    expect(parts.join('')).toBe(text);
  });

  it('одиночный «<» не считается тегом и не зацикливает резку', () => {
    const text = `${line(30)}<${line(30)}`;
    const parts = splitForTelegram(text, 20);
    expect(parts.join('')).toBe(text);
    expect(parts.every((p) => p.length > 0)).toBe(true);
  });
});

describe('replyLong', () => {
  it('шлёт столько сообщений, сколько кусков, с теми же настройками', async () => {
    const reply = jest.fn().mockResolvedValue(undefined);
    const text = Array.from({ length: 30 }, () => line(300)).join('\n\n');
    const ctx = { reply } as never;

    await replyLong(ctx, text, { parse_mode: 'HTML' });

    expect(reply.mock.calls.length).toBe(splitForTelegram(text).length);
    expect(reply.mock.calls.length).toBeGreaterThan(1);
    for (const [chunk, extra] of reply.mock.calls) {
      expect(chunk.length).toBeLessThanOrEqual(TELEGRAM_LIMIT);
      expect(extra).toEqual({ parse_mode: 'HTML' });
    }
  });

  it('короткий отчёт уходит одним сообщением', async () => {
    const reply = jest.fn().mockResolvedValue(undefined);
    await replyLong({ reply } as never, 'Готово');
    expect(reply).toHaveBeenCalledTimes(1);
    expect(reply).toHaveBeenCalledWith('Готово', undefined);
  });
});
