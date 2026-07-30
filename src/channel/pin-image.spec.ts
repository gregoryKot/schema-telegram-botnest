// Картинка пина: Pinterest не примет пин без изображения, поэтому проверяем
// не «нарисовалось что-то», а что это валидный PNG нужного формата (2:3 —
// лента Pinterest режет всё остальное) и что длинная фраза не ломает вёрстку.
import { renderPhrasePin, clampPinLines, makeChannelPost } from './pin-image';

/** Ширина и высота PNG лежат в IHDR — байты 16..23 после сигнатуры. */
function pngSize(buf: Buffer): { width: number; height: number } {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

describe('pin-image', () => {
  it('рисует PNG вертикального формата 2:3', () => {
    const png = renderPhrasePin('Ты сегодня сделал достаточно.');
    expect(png.subarray(0, 4)).toEqual(PNG_MAGIC);
    const { width, height } = pngSize(png);
    expect({ width, height }).toEqual({ width: 1000, height: 1500 });
  });

  it('длинная фраза не роняет рендер и остаётся в тех же границах', () => {
    const long = 'Список писал человек, который не знал про твою ночь. '.repeat(
      12,
    );
    const png = renderPhrasePin(long);
    expect(pngSize(png)).toEqual({ width: 1000, height: 1500 });
  });

  it('одна строка и многострочная фраза дают разные картинки', () => {
    const short = renderPhrasePin('Отдых не надо заслуживать.');
    const long = renderPhrasePin(
      'Отдых не надо заслуживать. Он входит в стоимость жизни, как сон и еда.',
    );
    expect(short.equals(long)).toBe(false);
  });

  describe('clampPinLines', () => {
    it('короткий текст оставляет как есть', () => {
      expect(clampPinLines(['раз', 'два'])).toEqual(['раз', 'два']);
    });

    it('лишние строки срезает, последнюю закрывает многоточием', () => {
      const lines = Array.from({ length: 15 }, (_, i) => `строка ${i}`);
      const clamped = clampPinLines(lines);
      expect(clamped).toHaveLength(11);
      expect(clamped[10]).toBe('строка 10…');
    });

    it('не оставляет висящий знак препинания перед многоточием', () => {
      const lines = Array.from({ length: 12 }, () => 'текст,');
      expect(clampPinLines(lines)[10]).toBe('текст…');
    });
  });

  describe('makeChannelPost', () => {
    it('картинка считается один раз на публикацию', async () => {
      const post = makeChannelPost('Тебе можно остановиться.');
      const [first, second] = await Promise.all([post.image(), post.image()]);
      expect(first).toBe(second);
      expect(first.subarray(0, 4)).toEqual(PNG_MAGIC);
    });

    it('текст доезжает до площадок без изменений', () => {
      expect(makeChannelPost('Так бывает у живых людей.').text).toBe(
        'Так бывает у живых людей.',
      );
    });
  });
});
