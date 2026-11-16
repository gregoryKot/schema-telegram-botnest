// Куда ведёт вызов, для гейта check-telegram-chat-id.mjs (разбор —
// telegram-chat-id-flow.mjs). Без типов: объявление ищется по импорту
// (`import { notify } from './x'` → функция notify файла x) и по классу
// получателя (`this.mail.send(` → тип поля `mail: Mail` или `new Mail(` →
// метод send в `class Mail`). Не нашлось — null, и вызывающий берёт все
// одноимённые объявления src/** (старое правило: адресный аргумент — общий).
import { posix } from 'path';
import { matchBrace } from './gate-balance.mjs';

const esc = (s) => s.replace(/\$/g, '\\$');
const IMPORT_RE = /\bimport\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"](\.[^'"]+)['"]/g;

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

/** `{` тела `class cls` в src; -1 — класса нет. */
function classAt(src, cls) {
  const m = new RegExp(String.raw`\bclass\s+${esc(cls)}\b[^{]*\{`).exec(src);
  return m ? m.index + m[0].length - 1 : -1;
}

/** Класс получателя `this.r` / `r` по файлу: тип поля или параметра `r: Cls`, `r = new Cls(`. */
export function receiverClass(src, recv) {
  const name = /^(?:this\.)?([A-Za-z_$][\w$]*)$/.exec(recv ?? '')?.[1];
  if (!name) return null;
  const n = esc(name);
  const typed = new RegExp(String.raw`(?<![\w$.])${n}\s*\??\s*:\s*([A-Z][\w$]*)\s*(?=[,;)={\n])`).exec(src);
  return typed?.[1] ?? new RegExp(String.raw`(?<![\w$.])${n}\s*=\s*new\s+([A-Z][\w$]*)\b`).exec(src)?.[1] ?? null;
}

/**
 * Объявления, куда ведёт вызов name( в файле f: pre '' — голое имя, 'this.' —
 * свой файл, '.' — метод получателя recv. fnsOf(file) — функции файла.
 * null — без типов не разрешить.
 */
export function resolveDefs(files, f, fnsOf, { pre, name, recv, open }) {
  const own = (file, n) => fnsOf(file).filter((fn) => fn.name === n && !fn.inert && fn.head !== open);
  if (pre !== '.') {
    const local = own(f, name);
    if (local.length || pre === 'this.') return local.length ? local : null;
    const imp = importedFrom(files, f, name);
    const defs = imp ? own(imp.file, imp.name) : [];
    return defs.length ? defs : null;
  }
  const cls = receiverClass(f.src, recv);
  if (!cls) return null;
  const home = importedFrom(files, f, cls)?.file ?? [f, ...files].find((x) => classAt(x.src, cls) >= 0);
  const at = home ? classAt(home.src, cls) : -1;
  if (at < 0) return null;
  const end = matchBrace(home.src, at);
  const defs = own(home, name).filter((fn) => fn.head > at && fn.head < end);
  return defs.length ? defs : null;
}
