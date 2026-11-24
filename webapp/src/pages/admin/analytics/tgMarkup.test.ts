import { describe, it, expect } from 'vitest';
import { parseTgMarkup } from './tgMarkup';

describe('parseTgMarkup', () => {
  it('b, i, code превращаются в флаги сегментов', () => {
    expect(parseTgMarkup('a <b>b</b> <i>i</i> <code>c</code>')).toEqual([
      { text: 'a ' }, { text: 'b', b: true }, { text: ' ' }, { text: 'i', i: true }, { text: ' ' }, { text: 'c', code: true },
    ]);
  });
  it('вложенность складывает флаги', () => {
    expect(parseTgMarkup('<b>x<i>y</i></b>')).toEqual([{ text: 'x', b: true }, { text: 'y', b: true, i: true }]);
  });
  it('сущности раскодируются один раз', () => {
    expect(parseTgMarkup('1 &lt; 2 &amp;&amp; &quot;x&quot; &gt; 0 &amp;lt;')).toEqual([{ text: '1 < 2 && "x" > 0 &lt;' }]);
  });
  it('чужой тег и закрывающий без пары остаются текстом', () => {
    expect(parseTgMarkup('<script>x</script></b><a href="u">l</a>')).toEqual([{ text: '<script>x</script></b><a href="u">l</a>' }]);
  });
  it('пустая строка — пустой список; переносы сохраняются', () => {
    expect(parseTgMarkup('')).toEqual([]);
    expect(parseTgMarkup('a\nb')).toEqual([{ text: 'a\nb' }]);
  });
});
