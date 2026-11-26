// Серверный рендер статьи для краулеров (аудит 2026-11, S19): раньше тело
// чистил регэксп `<script[\s\S]*?<\/script>`, который обходится вложением и
// не трогает обработчики событий и javascript:-ссылки. Каждый пейлоад ниже
// проходил тот регэксп; санитайзер обязан выпустить из них только текст.
import { sanitizeArticleHtml as clean } from './article-html-sanitize';
import { ARTICLE_SEED } from './articles.seed';

/** Исполнимое в браузере: тег script, обработчик on*, адрес javascript:/data:. */
const EXECUTABLE =
  /<script|<[^>]*\son[a-z]+\s*=|(?:href|src)\s*=\s*"?\s*(?:javascript|data|vbscript):/i;

describe('sanitizeArticleHtml — обходные пейлоады', () => {
  it.each([
    ['вложенный script', '<scr<script></script>ipt src=//evil.js></script>'],
    ['вложенный script №2', '<scr<script>ipt>alert(1)</scr</script>ipt>'],
    ['пробел в закрывающем', '<script>alert(1)</script >'],
    ['регистр', '<ScRiPt>alert(1)</sCrIpT>'],
    ['незакрытый script', '<p>до</p><script>alert(1)'],
    ['самозакрытый script', '<script/>alert(1)</script>'],
    ['onerror', '<img src=x onerror=alert(1)>'],
    ['onerror у разрешённого тега', '<p onclick="alert(1)">т</p>'],
    ['svg onload', '<svg onload=alert(1)><circle r="1"/></svg>'],
    ['javascript: в href', '<a href="javascript:alert(1)">x</a>'],
    ['javascript: с пробелами', '<a href=" java\tscript:alert(1)">x</a>'],
    [
      'javascript: сущностями',
      '<a href="&#106;avascript&colon;alert(1)">x</a>',
    ],
    ['javascript: hex-сущностью', '<a href="&#x6A;avascript:alert(1)">x</a>'],
    [
      'data: в href',
      '<a href="data:text/html,<script>alert(1)</script>">x</a>',
    ],
    ['iframe', '<iframe src="javascript:alert(1)"></iframe>'],
    [
      'style с выражением',
      '<style>*{background:url(javascript:alert(1))}</style>',
    ],
    ['комментарий', '<!--><script>alert(1)</script>-->'],
    [
      'кавычка рвёт атрибут',
      '<a href="/x" title="a"onmouseover=alert(1)>x</a>',
    ],
    ['незакрытая кавычка', '<a href="/x onmouseover=alert(1) >x'],
  ])('%s → без исполнимого', (_, payload) => {
    const out = clean(payload);
    expect(out).not.toMatch(EXECUTABLE);
    expect(out).not.toMatch(/alert\(1\)<\/script/i);
  });

  it('script выбрасывается вместе с содержимым, текст рядом остаётся', () => {
    expect(clean('<p>до</p><script>alert(1)</script><p>после</p>')).toBe(
      '<p>до</p><p>после</p>',
    );
  });

  it('`<scr<script>…` — склейка не собирает тег, хвост уходит текстом', () => {
    const out = clean('<scr<script></script>ipt>alert(1)</script>');
    expect(out).not.toContain('<script');
    expect(out).toBe('ipt&gt;alert(1)');
  });

  it('обработчик снимается, разрешённый тег и класс остаются', () => {
    expect(clean('<p class="lead" onclick="alert(1)">т</p>')).toBe(
      '<p class="lead">т</p>',
    );
  });

  it('javascript:-ссылка теряет href, но не текст', () => {
    expect(clean('<a href="javascript:alert(1)">x</a>')).toBe('<a>x</a>');
  });
});

describe('sanitizeArticleHtml — законная разметка статьи', () => {
  it('ссылки: относительная, https, mailto, якорь — остаются', () => {
    const html =
      '<p><a href="/booking">a</a><a href="https://x.ru/?a=1&amp;b=2" target="_blank" rel="noopener">b</a>' +
      '<a href="mailto:a@b.ru">c</a><a href="#top">d</a></p>';
    expect(clean(html)).toBe(html);
  });

  it('таблица, списки, заголовки, перевод строки', () => {
    const html =
      '<h2>З</h2><h3>П</h3><ul><li><strong>a</strong> <em>b</em></li></ul>' +
      '<ol><li>1</li></ol><table><thead><tr><th>к</th></tr></thead>' +
      '<tbody><tr><td>я</td></tr></tbody></table><p>a<br>b</p>';
    expect(clean(html)).toBe(html);
  });

  it('SVG-рисунок: viewBox в каноническом написании, самозакрытые фигуры', () => {
    expect(
      clean('<svg viewbox="0 0 10 10"><path d="M0 0L1 1" fill="none"/></svg>'),
    ).toBe(
      '<svg viewBox="0 0 10 10"><path d="M0 0L1 1" fill="none"></path></svg>',
    );
  });

  it('текст: < и > экранируются, сущности (&mdash;, &#8212;) не портятся', () => {
    expect(clean('<p>a < b > c &mdash; d &#8212; e & f</p>')).toBe(
      '<p>a &lt; b &gt; c &mdash; d &#8212; e &amp; f</p>',
    );
  });

  it('незакрытые теги закрываются, лишние закрывающие отбрасываются', () => {
    expect(clean('<p><strong>a')).toBe('<p><strong>a</strong></p>');
    expect(clean('a</div></p></td>b')).toBe('ab');
  });

  it('чужой тег уходит, его текст остаётся', () => {
    expect(clean('<div><span>текст</span></div>')).toBe('текст');
  });

  it('все статьи сида проходят без потерь (кроме <hr/> → <hr>)', () => {
    for (const a of ARTICLE_SEED) {
      expect(clean(a.content)).toBe(a.content.replace(/<hr\/>/g, '<hr>'));
    }
  });
});
