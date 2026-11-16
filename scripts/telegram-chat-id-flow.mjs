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
// (`notify(userId)` → `sendTg(id)` в соседнем файле, класс #456). Куда ведёт
// вызов, решает `telegram-chat-id-resolve.mjs`: свой файл, импорт, класс
// получателя (`this.mail.send(` → `mail: Mail`). Не разрешился — все
// одноимённые объявления src/**, и аргумент адресный, только если он адресный
// у каждого: иначе `send` почты, очереди и канала слились бы в одного
// «отправщика». Адрес полем параметра (`s.chatId`, `({ chatId })`) берётся из
// литерала вызова `f({ chatId: userId })`, а у объекта-переменной `f(s)` — из
// её литерала, присваивания или литерала, который возвращает функция-источник
// (`telegram-chat-id-objects.mjs`; `resolveChatId`/`telegramIdFor` там —
// законный адрес). Слепые зоны (образцы — в спеке): получатель без типа в
// файле (`this.deps.bot.send(`), источник без объявления (`map.get(id)`).
import { lineAt } from './gate-balance.mjs';
import { callArgs, functionsOf } from './gate-functions.mjs';
import { objectField } from './telegram-chat-id-objects.mjs';
import { declaring, fieldOf } from './telegram-chat-id-params.mjs';
import { resolveDefs } from './telegram-chat-id-resolve.mjs';

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
  const homeOf = new Map(); // объявление → файл
  const fnsOf = (f) => {
    if (!parsed.has(f)) parsed.set(f, functionsOf(f.src));
    for (const fn of parsed.get(f)) homeOf.set(fn, f);
    return parsed.get(f);
  };
  const addr = new Map(); // объявление → индексы адресных параметров
  const byName = new Map();
  const named = (name) => {
    if (!byName.has(name)) {
      const re = new RegExp(String.raw`(?<![\w$])${esc(name)}\s*(?:<[^()]*>)?\s*[(:=]`);
      byName.set(name, files.filter((f) => re.test(f.src)).flatMap((f) => fnsOf(f).filter((fn) => fn.name === name && !fn.inert)));
    }
    return byName.get(name);
  };
  // Объявления вызова: разрешённые (свой файл, импорт, класс) или все одноимённые.
  const defsOf = (f, call) => resolveDefs(files, f, fnsOf, call) ?? named(call.name);
  // Источник объекта-переменной — только разрешённый или единственный одноимённый.
  const defsFor = (f, call) => resolveDefs(files, f, fnsOf, call) ?? (named(call.name).length === 1 ? named(call.name) : []);
  const ctx = { fnsOf, homeOf: (fn) => homeOf.get(fn), defsFor };
  // Адресные аргументы вызова name(: общие для всех объявлений, куда он ведёт.
  const addressArgs = (f, call) => {
    const sets = defsOf(f, call).map((d) => addr.get(d) ?? new Set());
    const ks = sets.length ? [...sets[0]].filter((k) => sets.every((s) => s.has(k))) : [];
    return call.name in SEED_SENDERS ? [...new Set([SEED_SENDERS[call.name], ...ks])] : ks;
  };
  const sites = (f) => {
    const out = [];
    for (const m of f.src.matchAll(API_RE)) out.push({ file: f, at: m.index, target: callArgs(f.src, m.index + m[0].length - 1)[0] });
    for (const m of f.src.matchAll(CHAT_ID_RE)) out.push({ file: f, at: m.index, target: m[1] });
    const names = new Set([...Object.keys(SEED_SENDERS), ...[...addr.keys()].map((d) => d.name)]);
    const callRe = new RegExp(String.raw`(?:((?<![\w$])this\.|\.)\s*)?(?<![\w$])(${[...names].map(esc).join('|')})\s*\(`, 'g');
    for (const m of f.src.matchAll(callRe)) {
      const open = m.index + m[0].length - 1;
      if (fnsOf(f).some((fn) => fn.head === open)) continue; // объявление, а не вызов
      const list = callArgs(f.src, open);
      const via = m[2] in SEED_SENDERS ? undefined : m[2];
      const pre = m[1] === '.' ? '.' : m[1] ?? '';
      const recv = pre === '.' ? /((?:this\.)?[A-Za-z_$][\w$]*)\s*$/.exec(f.src.slice(Math.max(0, m.index - 80), m.index))?.[1] : undefined;
      for (const k of addressArgs(f, { pre, name: m[2], recv, open })) {
        const [i, field] = String(k).split('.');
        const arg = list[i] ?? '';
        const target = field ? fieldOf(arg, field) : arg;
        if (target) out.push({ file: f, at: m.index, target, via });
        else if (field && /^[A-Za-z_$][\w$]*$/.test(arg.trim())) {
          for (const o of objectField(f, arg.trim(), field, m.index, ctx)) out.push({ ...o, via });
        }
      }
    }
    return out.filter((s) => s.target);
  };
  for (let changed = true; changed; ) {
    changed = false;
    for (const f of files) {
      for (const s of sites(f)) {
        const { src } = s.file;
        const hit = sourceNames(s.target, src).map((n) => declaring(fnsOf(s.file), src, s.at, n)).find(Boolean);
        if (!hit) continue;
        const ks = addr.get(hit.fn) ?? new Set();
        if (!ks.has(hit.k)) { addr.set(hit.fn, ks.add(hit.k)); changed = true; }
      }
    }
  }
  const found = [];
  const seen = new Set();
  for (const f of files) {
    for (const s of sites(f)) {
      const key = `${s.file.rel}:${s.at}:${norm(s.target)}`;
      if (!s.file.report || s.synthetic || seen.has(key) || !isAccountId(s.target, s.file.src)) continue;
      seen.add(key);
      found.push({ rel: s.file.rel, line: lineAt(s.file.src, s.at), expr: norm(s.target), via: s.via });
    }
  }
  return found;
}
