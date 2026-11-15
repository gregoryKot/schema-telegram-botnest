// Разбор для гейта check-telegram-chat-id.mjs (движок — там же: обход, отчёт).
// Адрес отправки — первый аргумент `.sendMessage(`/`.sendPhoto(`/…, адресный
// аргумент отправщика (`sendTg` — 0, `sendBounded` — 1) и значение `chat_id:`.
// Нарушение — адрес, приведённый из id аккаунта (`userId`, `x.userId`, `uid`,
// `user.id`, в том числе через `Number()`/`String()`/`BigInt()`/`.toString()`),
// сразу или через одну переменную файла.
//
// Межфайловый шаг: функция, чей параметр доходит до адреса (сам, через
// приведение или одну переменную), сама становится отправщиком, и этот
// аргумент проверяется у всех её вызывающих — до неподвижной точки
// (`notify(userId)` → `sendTg(id)` в соседнем файле, класс #456). Вызов
// `this.x(`/`x(` ищет объявление сначала в своём файле, `obj.x(` — по имени во
// всём src/**; у нескольких одноимённых объявлений аргумент адресный, только
// если он адресный у каждого: иначе `send` почты, очереди и канала слились бы
// в одного «отправщика». Слепые зоны: адрес полем параметра (`s.chatId`,
// `({ chatId })`): параметр-объект, поле которого доходит до адреса, делает функцию
// отправщиком, и поле берётся из литерала `f({ chatId: userId })` (объект-переменная
// и адрес из `resolveChatId` по данным не прослеживаются). Слепая зона: одноимённые
// функции, из которых отправляет не каждая.
import { lineAt } from './gate-balance.mjs';
import { callArgs, functionsOf } from './gate-functions.mjs';
import { declaring, fieldOf } from './telegram-chat-id-params.mjs';

const API_RE = /\.(?:sendMessage|sendPhoto|sendDocument|sendVideo|sendAnimation|sendMediaGroup|sendChatAction|copyMessage|forwardMessage)\s*\(/g;
const CHAT_ID_RE = /\bchat_id\s*:\s*([^,}\n]+)/g;
// Отправщики по имени, без разбора объявления: имя → адресный аргумент.
export const SEED_SENDERS = { sendTg: 0, sendBounded: 1 };
const ACCOUNT_ID = String.raw`(?:[\w$.]*\.userId|userId|uid|user\.id)`;
export const DIRECT_RE = new RegExp(
  String.raw`^(?:(?:Number|String|BigInt)\(\s*${ACCOUNT_ID}\s*\)|${ACCOUNT_ID}(?:\.toString\(\))?)$`,
);
const REF = String.raw`[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)?`;
const CAST_RE = new RegExp(String.raw`^(?:(?:Number|String|BigInt)\(\s*(${REF})\s*\)|(${REF})(?:\.toString\(\))?)$`);
const esc = (s) => s.replace(/\$/g, '\\$');
const norm = (e) => e.replace(/\s+/g, ' ').trim();
const declOf = (src, name) =>
  new RegExp(String.raw`\b(?:const|let|var)\s+${esc(name)}\s*(?::[^=]+)?=\s*([^;\n]+)`).exec(src)?.[1].trim();
const castOf = (e) => { const m = CAST_RE.exec(norm(e)); return m ? m[1] ?? m[2] : null; };

/** Адрес — id аккаунта: напрямую или через одну переменную файла. */
function isAccountId(expr, src) {
  const e = norm(expr);
  if (DIRECT_RE.test(e)) return true;
  const decl = /^[A-Za-z_$][\w$]*$/.test(e) && declOf(src, e);
  return !!decl && DIRECT_RE.test(decl);
}

/** Имена, из которых приведён адрес: `to`, `Number(to)`; через одну переменную — и её источник. */
function sourceNames(expr, src) {
  const id = castOf(expr);
  if (!id) return [];
  const decl = declOf(src, id);
  const inner = decl && castOf(decl);
  return inner ? [id, inner] : [id];
}

/** files: [{ rel, src, report }] с вырезанными комментариями → [{ rel, line, expr, via }]. */
export function findViolations(files) {
  const parsed = new Map();
  const fnsOf = (f) => parsed.get(f) ?? parsed.set(f, functionsOf(f.src)).get(f);
  const addr = new Map(); // объявление → индексы адресных параметров
  const byName = new Map();
  const named = (name) => {
    if (!byName.has(name)) {
      const re = new RegExp(String.raw`(?<![\w$])${esc(name)}\s*(?:<[^()]*>)?\s*[(:=]`);
      byName.set(name, files.filter((f) => re.test(f.src)).flatMap((f) => fnsOf(f).filter((fn) => fn.name === name && !fn.inert)));
    }
    return byName.get(name);
  };
  // Адресные аргументы вызова name(: общие для всех объявлений, куда он ведёт.
  const addressArgs = (f, pre, name, open) => {
    const local = pre === '.' ? [] : fnsOf(f).filter((fn) => fn.name === name && !fn.inert && fn.head !== open);
    const defs = local.length ? local : named(name);
    const sets = defs.map((d) => addr.get(d) ?? new Set());
    const ks = sets.length ? [...sets[0]].filter((k) => sets.every((s) => s.has(k))) : [];
    return name in SEED_SENDERS ? [...new Set([SEED_SENDERS[name], ...ks])] : ks;
  };
  const sites = (f) => {
    const out = [];
    for (const m of f.src.matchAll(API_RE)) out.push({ at: m.index, target: callArgs(f.src, m.index + m[0].length - 1)[0] });
    for (const m of f.src.matchAll(CHAT_ID_RE)) out.push({ at: m.index, target: m[1] });
    const names = new Set([...Object.keys(SEED_SENDERS), ...[...addr.keys()].map((d) => d.name)]);
    const callRe = new RegExp(String.raw`(?:((?<![\w$])this\.|\.)\s*)?(?<![\w$])(${[...names].map(esc).join('|')})\s*\(`, 'g');
    for (const m of f.src.matchAll(callRe)) {
      const open = m.index + m[0].length - 1;
      if (fnsOf(f).some((fn) => fn.head === open)) continue; // объявление, а не вызов
      const list = callArgs(f.src, open);
      const via = m[2] in SEED_SENDERS ? undefined : m[2];
      for (const k of addressArgs(f, m[1] === '.' ? '.' : m[1] ?? '', m[2], open)) {
        const [i, field] = String(k).split('.');
        const target = field ? fieldOf(list[i] ?? '', field) : list[i];
        if (target) out.push({ at: m.index, target, via });
      }
    }
    return out.filter((s) => s.target);
  };
  for (let changed = true; changed; ) {
    changed = false;
    for (const f of files) {
      for (const s of sites(f)) {
        const hit = sourceNames(s.target, f.src).map((n) => declaring(fnsOf(f), f.src, s.at, n)).find(Boolean);
        if (!hit) continue;
        const ks = addr.get(hit.fn) ?? new Set();
        if (!ks.has(hit.k)) { addr.set(hit.fn, ks.add(hit.k)); changed = true; }
      }
    }
  }
  const found = [];
  for (const f of files.filter((x) => x.report)) {
    const seen = new Set();
    for (const s of sites(f)) {
      const key = `${s.at}:${norm(s.target)}`;
      if (seen.has(key) || !isAccountId(s.target, f.src)) continue;
      seen.add(key);
      found.push({ rel: f.rel, line: lineAt(f.src, s.at), expr: norm(s.target), via: s.via });
    }
  }
  return found;
}
