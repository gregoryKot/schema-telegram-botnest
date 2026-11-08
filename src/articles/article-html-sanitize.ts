import {
  ARTICLE_ALLOWED_ATTR,
  ARTICLE_ALLOWED_TAGS,
  ARTICLE_URI_ATTR,
} from './article-html-allowlist';

// Санитайзер тела статьи для серверного рендера (аудит 2026-11, S19). Раньше
// рендер вырезал `<script>…</script>` регэкспом — `<scr<script></script>ipt>`
// собирался обратно в <script>, а `onerror=`/`javascript:` не трогались вовсе.
//
// Принцип — пересборка, а не вычёркивание: вход разбирается на текст и теги,
// а наружу пишется ТОЛЬКО то, что собрано заново — тег из allowlist'а
// (article-html-allowlist.ts, тот же, что у DOMPurify на клиенте) с
// атрибутами из allowlist'а в двойных кавычках и экранированным значением;
// весь остальной текст экранируется (`<` → `&lt;`). Чего санитайзер не понял,
// то для браузера — текст, а не разметка. Открытые теги закрываются в конце,
// лишние закрывающие отбрасываются: тело не вылезает из <div id="root">.
// Зависимость (sanitize-html/DOMPurify+jsdom) не понадобилась: в корневом
// package.json нет ни одной, а разбор ниже линейный и без DOM.

const TAGS: ReadonlySet<string> = new Set(ARTICLE_ALLOWED_TAGS);
/** Имя атрибута в нижнем регистре → каноническое написание (viewBox). */
const ATTRS = new Map<string, string>(
  ARTICLE_ALLOWED_ATTR.map((a) => [a.toLowerCase(), a]),
);
const URI_ATTRS: ReadonlySet<string> = new Set(ARTICLE_URI_ATTR);
const VOID: ReadonlySet<string> = new Set(['br', 'hr']);
// Сырой текст: браузер читает их содержимое как текст до `</имя`, и смысла в
// нём для статьи нет — выбрасывается вместе с тегом (как FORBID_CONTENTS у
// DOMPurify). У остальных чужих тегов выбрасывается тег, текст остаётся.
// prettier-ignore
const DROP_WITH_CONTENT: ReadonlySet<string> = new Set([
  'script', 'style', 'template', 'iframe', 'noembed', 'noframes', 'noscript',
  'title', 'xmp', 'textarea',
]);

// Схемы адресов — регэксп DOMPurify (ALLOWED_URI_REGEXP): разрешённая схема,
// либо адрес без схемы (`/x`, `#x`, `page.html`).
const SAFE_URI =
  /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i;
// Пробелы и управляющие символы браузер из адреса выкидывает: `java\tscript:`.
const URI_WHITESPACE =
  /[\x00-\x20\x7F-\xA0\u1680\u180E\u2000-\u2029\u205F\u3000]/g; // eslint-disable-line no-control-regex

// prettier-ignore
const NAMED: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", colon: ':', tab: '\t',
  newline: '\n', nbsp: '\u00A0',
};

/** Ссылки на символы в значении атрибута — как их раскроет браузер. */
function decodeEntities(s: string): string {
  return s.replace(
    /&(?:#(\d{1,7})|#x([0-9a-f]{1,6})|([a-z]{2,8}));?/gi,
    (m, dec?: string, hex?: string, name?: string) => {
      if (name) return NAMED[name.toLowerCase()] ?? m;
      const cp = dec ? Number(dec) : parseInt(hex ?? '', 16);
      return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : '\uFFFD';
    },
  );
}

const escapeAttr = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

/** Текст: `<`/`>` экранируются, `&` — если это не ссылка на символ. */
const escapeText = (s: string) =>
  s
    .replace(
      /&(?!(?:[a-z][a-z0-9]{1,31}|#\d{1,7}|#x[0-9a-f]{1,6});)/gi,
      '&amp;',
    )
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

interface Tag {
  end: boolean;
  name: string;
  attrs: [string, string][];
  selfClosing: boolean;
  next: number; // индекс сразу после `>`
}

const TAG_HEAD = /<(\/?)([a-z][^\s/>]*)/iy;
// Разделитель, затем `>` или атрибут: имя [= "…" | '…' | без кавычек].
const ATTR =
  /([\s/]*)(?:(>)|([^\s/>][^\s/>=]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>][^\s>]*)?))?)/y;

/** Тег с позиции `at`; null — это не тег (текст) или тег не закрыт до конца. */
function readTag(html: string, at: number): Tag | null | 'eof' {
  TAG_HEAD.lastIndex = at;
  const head = TAG_HEAD.exec(html);
  if (!head) return null;
  const tag: Tag = {
    end: head[1] === '/',
    name: head[2].toLowerCase(),
    attrs: [],
    selfClosing: false,
    next: 0,
  };
  let i = TAG_HEAD.lastIndex;
  for (;;) {
    ATTR.lastIndex = i;
    const m = ATTR.exec(html);
    if (!m || ATTR.lastIndex === i) return 'eof';
    if (m[2]) {
      tag.selfClosing = m[1].endsWith('/'); // `<br/>`, но не `<a href=/x/>`
      tag.next = ATTR.lastIndex;
      return tag;
    }
    tag.attrs.push([m[3].toLowerCase(), m[4] ?? m[5] ?? m[6] ?? '']);
    i = ATTR.lastIndex;
  }
}

function renderAttrs(attrs: [string, string][]): string {
  const seen = new Set<string>();
  let out = '';
  for (const [name, raw] of attrs) {
    const canon = ATTRS.get(name);
    if (!canon || seen.has(name)) continue; // как в браузере: первый выигрывает
    seen.add(name);
    const value = decodeEntities(raw);
    if (
      URI_ATTRS.has(canon) &&
      !SAFE_URI.test(value.replace(URI_WHITESPACE, ''))
    )
      continue;
    out += ` ${canon}="${escapeAttr(value)}"`;
  }
  return out;
}

/** Пропускает содержимое сырого элемента до его `</имя…>`; индекс после. */
function skipRawContent(html: string, from: number, name: string): number {
  const close = new RegExp(`</${name}[\\s/>]`, 'ig');
  close.lastIndex = from;
  if (!close.exec(html)) return html.length;
  const gt = html.indexOf('>', close.lastIndex - 1);
  return gt < 0 ? html.length : gt + 1;
}

/** Тело статьи → HTML только из allowlist'а; всё прочее — экранированный текст. */
export function sanitizeArticleHtml(html: string): string {
  const out: string[] = [];
  const open: string[] = [];
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt < 0) {
      out.push(escapeText(html.slice(i)));
      break;
    }
    out.push(escapeText(html.slice(i, lt)));
    if (/^<(!|\?|\/[^a-z])/i.test(html.slice(lt, lt + 3))) {
      // Комментарий, <!DOCTYPE>, <?…>, </ …> — выбрасываются до конца.
      const end = html.startsWith('<!--', lt)
        ? html.indexOf('-->', lt + 4)
        : html.indexOf('>', lt);
      i = end < 0 ? html.length : end + (html.startsWith('<!--', lt) ? 3 : 1);
      continue;
    }
    const tag = readTag(html, lt);
    if (tag === 'eof') break; // незакрытый тег в конце — браузер его тоже не покажет
    if (!tag) {
      out.push('&lt;');
      i = lt + 1;
      continue;
    }
    i = tag.next;
    if (tag.end) {
      const at = open.lastIndexOf(tag.name);
      if (at >= 0) while (open.length > at) out.push(`</${open.pop()}>`);
    } else if (tag.name === 'plaintext') {
      break;
    } else if (DROP_WITH_CONTENT.has(tag.name)) {
      i = skipRawContent(html, i, tag.name); // `<script/>` — тоже не пустой
    } else if (TAGS.has(tag.name)) {
      out.push(`<${tag.name}${renderAttrs(tag.attrs)}>`);
      if (VOID.has(tag.name)) continue;
      if (tag.selfClosing) out.push(`</${tag.name}>`);
      else open.push(tag.name);
    }
  }
  while (open.length) out.push(`</${open.pop()}>`);
  return out.join('');
}
