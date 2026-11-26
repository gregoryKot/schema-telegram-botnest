// Куда ведёт вызов, для гейта check-telegram-chat-id.mjs (разбор —
// telegram-chat-id-flow.mjs). Без типов: объявление ищется по импорту
// (`import { notify } from './x'` → функция notify файла x) и по типу
// получателя (`this.mail.send(` → тип поля `mail: Mail` или `new Mail(` →
// метод send в `class Mail`; цепочка и интерфейс — telegram-chat-id-types.mjs).
// Не нашлось — null, и вызывающий берёт все одноимённые объявления src/**
// (старое правило: адресный аргумент — общий).
import { importedFrom, methodsOf } from './telegram-chat-id-types.mjs';

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
  return methodsOf(files, f, recv, name, own);
}
