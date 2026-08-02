// Картинка пина: Pinterest не примет пин без изображения, поэтому проверяем
// не «нарисовалось что-то», а что это валидный PNG нужного формата (2:3 —
// лента Pinterest режет всё остальное) и что длинная фраза не ломает вёрстку.
import { renderPhrasePin, clampPinLines, makeChannelPost } from './pin-image';
import { pinStyle } from './pin-style';

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

  it('одна и та же фраза рисуется одинаково — повтор не даст второй вид', () => {
    // Оформление берётся из текста, а не случайно: ретрай отправки не должен
    // порождать непохожий пин на ту же фразу.
    const text = 'Ты имеешь право передумать.';
    expect(renderPhrasePin(text).equals(renderPhrasePin(text))).toBe(true);
  });

  it('разные фразы получают разное оформление, а не только разный текст', () => {
    // Лента Pinterest — витрина превью: одинаковые пины подряд читаются как
    // один, показанный много раз. Совпадения при случайном выборе неизбежны,
    // поэтому проверяем не «все разные», а что вариантов действительно много.
    const looks = new Set<string>();
    const palettes = new Set<string>();
    for (let i = 0; i < 24; i++) {
      const s = pinStyle(`фраза номер ${i} про заботу о себе`);
      palettes.add(s.palette.name);
      looks.add(
        [s.palette.name, s.layout, s.backdrop, s.corner, s.decor].join(),
      );
    }
    expect(looks.size).toBeGreaterThanOrEqual(20);
    expect(palettes.size).toBeGreaterThanOrEqual(8);
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
      expect(clampPinLines(['раз', 'два'], 11)).toEqual(['раз', 'два']);
    });

    it('лишние строки срезает, последнюю закрывает многоточием', () => {
      const lines = Array.from({ length: 15 }, (_, i) => `строка ${i}`);
      const clamped = clampPinLines(lines, 11);
      expect(clamped).toHaveLength(11);
      expect(clamped[10]).toBe('строка 10…');
    });

    it('не оставляет висящий знак препинания перед многоточием', () => {
      const lines = Array.from({ length: 12 }, () => 'текст,');
      expect(clampPinLines(lines, 11)[10]).toBe('текст…');
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
