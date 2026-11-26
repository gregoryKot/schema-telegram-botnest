// Типы по тексту, для гейта check-telegram-chat-id.mjs (куда ведёт вызов —
// telegram-chat-id-resolve.mjs). Компилятора нет: тип берётся из аннотации.
//   - получатель цепочкой: `this.deps.channel` → `deps: Deps` → поле
//     `channel: Channel` в `interface Deps` (свой файл, импорт, любой файл src);
//   - получатель из деструктуризации: `const { channel } = this.deps`;
//   - получатель-интерфейс: `target: ChannelTarget` → метод каждого класса
//     `implements ChannelTarget` (вызов может прийти в любой из них).
// Обёртки `Pick<T, …>`, `Readonly<T>` и соседи раскрываются до T.
import { posix } from 'path';
import { matchBrace } from './gate-balance.mjs';

const esc = (s) => s.replace(/\$/g, '\\$');
const ID = String.raw`[A-Za-z_$][\w$]*`;
const WRAP = String.raw`(?:(?:Pick|Omit|Readonly|Partial|Required)<\s*)?`;
const IMPORT_RE = /\bimport\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"](\.[^'"]+)['"]/g;
const MAX_HOPS = 3;

/** Файл по относительному пути импорта из rel: `x.ts` или `x/index.ts`. */
function fileAt(files, rel, spec) {
  const base = posix.join(posix.dirname(rel), spec).replace(/\.js$/, '');
  return files.find((x) => x.rel === `${base}.ts` || x.rel === `${base}/index.ts`);
}

/** Откуда в файле f импортировано имя name: { file, name } (с учётом `as`) или null. */
export function importedFrom(files, f, name) {
  for (const m of f.src.matchAll(IMPORT_RE)) {
    for (const part of m[1].split(',')) {
      const p = /^\s*(?:type\s+)?([\w$]+)(?:\s+as\s+([\w$]+))?\s*$/.exec(part);
      if (p && (p[2] ?? p[1]) === name) {
        const file = fileAt(files, f.rel, m[2]);
        return file ? { file, name: p[1] } : null;
      }
    }
  }
  return null;
}

/** Тип имени по тексту: `name: Cls`, `name?: Pick<Cls, …>`, `name = new Cls(`. */
export function typeOfName(src, name) {
  const n = esc(name);
  const typed = new RegExp(String.raw`(?<![\w$.])${n}\s*\??\s*:\s*${WRAP}([A-Z][\w$]*)\s*(?=[,;)={\n>])`).exec(src);
  return typed?.[1] ?? new RegExp(String.raw`(?<![\w$.])${n}\s*=\s*new\s+([A-Z][\w$]*)\b`).exec(src)?.[1] ?? null;
}

/** `{` тела объявления типа в src и его вид; null — объявления нет. */
function declAt(src, type) {
  const t = esc(type);
  const m = new RegExp(String.raw`\b(class|interface)\s+${t}\b[^{;]*\{|\btype\s+${t}\s*=\s*\{`).exec(src);
  return m ? { at: m.index + m[0].length - 1, kind: m[1] === 'class' ? 'class' : 'shape' } : null;
}

/** Где объявлен тип, видимый из файла f: { file, name, at, kind }; импорт, свой файл, любой файл. */
export function typeHome(files, f, type) {
  const imp = importedFrom(files, f, type);
  const name = imp?.name ?? type;
  for (const file of [...(imp ? [imp.file] : []), f, ...files]) {
    const decl = declAt(file.src, name);
    if (decl) return { file, name, ...decl };
  }
  return null;
}

/** Тип получателя `this.a.b` / `a.b` / `a`: { type, file } (file — откуда тип виден) или null. */
export function receiverType(files, f, recv, hops = 0) {
  const segs = (recv ?? '').replace(/^this\./, '').replace(/\?/g, '').split('.');
  if (segs.some((s) => !new RegExp(`^${ID}$`).test(s))) return null;
  let type = typeOfName(f.src, segs[0]);
  let file = f;
  if (!type && hops < MAX_HOPS) {
    const from = new RegExp(String.raw`\{[^{}=]*(?<![\w$])${esc(segs[0])}(?![\w$])[^{}=]*\}\s*=\s*((?:this\.)?${ID}(?:\.${ID})*)\s*[;\n]`).exec(f.src);
    const up = from && receiverType(files, f, `${from[1]}.${segs[0]}`, hops + 1);
    if (up) ({ type, file } = up);
  }
  for (const seg of segs.slice(1)) {
    const home = type && typeHome(files, file, type);
    if (!home) return null;
    type = typeOfName(home.file.src.slice(home.at, matchBrace(home.file.src, home.at) + 1), seg);
    file = home.file;
  }
  return type ? { type, file } : null;
}

/**
 * Методы name получателя recv в файле f; own(file, name) — функции файла с этим
 * именем. У класса — его метод; у интерфейса — метод каждой реализации, и
 * список помечен `any`: адресный аргумент — у любой из них, а не у всех.
 * null — тип не объявлен в src или метода нет.
 */
export function methodsOf(files, f, recv, name, own) {
  const t = receiverType(files, f, recv);
  const home = t && typeHome(files, t.file, t.type);
  if (!home) return null;
  const inBody = (file, at) => {
    const end = matchBrace(file.src, at);
    return own(file, name).filter((fn) => fn.head > at && fn.head < end);
  };
  if (home.kind === 'class') {
    const defs = inBody(home.file, home.at);
    return defs.length ? defs : null;
  }
  const impl = new RegExp(String.raw`\bclass\s+${ID}\b[^{]*\bimplements\b[^{]*(?<![\w$])${esc(home.name)}(?![\w$])[^{]*\{`, 'g');
  const defs = files.flatMap((x) => [...x.src.matchAll(impl)].flatMap((m) => inBody(x, m.index + m[0].length - 1)));
  return defs.length ? Object.assign(defs, { any: true }) : null;
}
