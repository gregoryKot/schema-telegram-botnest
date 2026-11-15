// Параметры функций-отправщиков для telegram-chat-id-flow.mjs: из какого
// параметра (целиком, полем, шаблоном) взят адрес и как достать поле из литерала вызова.
import { callArgs, splitTop } from './gate-functions.mjs';

/** Параметр функции, откуда взято name: целиком (`k`), полем (`k.field` — `s.chatId`) или из шаблона `({ chatId })`. */
function paramKey(fn, src, name) {
  const [root, field] = name.split('.');
  if (fn.params.includes(root)) return field ? `${fn.params.indexOf(root)}.${field}` : fn.params.indexOf(root);
  if (field || fn.head < 0) return null;
  const texts = callArgs(src, fn.head);
  for (const [i, t] of texts.entries()) {
    const body = /^\{([^{}]*)\}/.exec(t.trim())?.[1];
    for (const part of body?.split(',') ?? []) {
      const m = /^\s*([\w$]+)\s*(?::\s*([\w$]+))?\s*(?:=.*)?$/s.exec(part);
      if (m && (m[2] ?? m[1]) === name) return `${i}.${m[1]}`;
    }
  }
  return null;
}

/** Ближайшая функция вокруг at, из параметра которой взят name: { fn, k }; у безымянной — null. */
export function declaring(fns, src, at, name) {
  let best = null;
  for (const fn of fns) {
    if (fn.start <= at && at < fn.end && (!best || fn.start > best.start) && paramKey(fn, src, name) !== null) best = fn;
  }
  return best?.name ? { fn: best, k: paramKey(best, src, name) } : null;
}

/** Значение поля из литерала объекта-аргумента `{ chatId: x, … }` / `{ chatId }`; spread и объект-переменная — undefined. */
export function fieldOf(arg, field) {
  const body = /^\{([\s\S]*)\}$/.exec(arg.trim())?.[1];
  for (const part of body ? splitTop(body) : []) {
    const m = new RegExp(String.raw`^\s*${field}\s*(?::\s*([\s\S]+))?$`).exec(part);
    if (m) return (m[1] ?? field).trim();
  }
  return undefined;
}
