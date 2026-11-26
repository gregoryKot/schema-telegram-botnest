#!/usr/bin/env node
// git merge driver для JSON-бейслайнов храповиков (.gitattributes → merge=ratchet-min
// / -max / -sum). Ставится в .git/config скриптом scripts/setup-merge-drivers.mjs.
//
// Зачем. Бейслайны — самый частый источник конфликтов параллельных агентов
// (у скалярных одна значимая строка на файл — конфликт ВСЕГДА), а ручное
// разрешение почти всегда неверное: агент берёт «свою» сторону и молча
// откатывает чужой прогресс — гейт зелёный, планка просто ниже.
//
// У храповика есть правильная семантика слияния, и она однозначна. Решение
// принимается для КАЖДОГО ключа отдельно и всегда трёхстороннее:
//   ключ изменила одна сторона — берём её значение как есть (вторая это место
//     не трогала, спорить не о чем; почему это важно — см. merge3);
//   ключ изменили ОБЕ — вот здесь и работает храповик:
//     ratchet-sum — счётчик, который складывается (строки файлов, байты JS,
//                   нарушения в файле): база плюс обе дельты;
//     ratchet-min — меньше лучше, но не складывается (планы запросов, axe);
//     ratchet-max — больше лучше (покрытие, mutation score).
// Режимы и исключения по ключам — merge-json-ratchet-rules.mjs; ветка поверх
// уже влитой squash-ветки (сумма задвоила бы общую правку) — -history.mjs.
// Так прогресс обеих сторон сохраняется, а планка не слабеет случайно.
//
// Вызов (git подставляет %O %A %B %P):
//   node scripts/merge-json-ratchet.mjs min|max|sum  %O %A %B %P
// %O — общий предок, %A — «наша» версия И файл, куда пишется результат,
// %B — «их» версия, %P — путь файла в рабочем дереве (сообщения и ключ KEY_MODES).
//
// Выход 0 — слито, git считает конфликт разрешённым; выход 1 — не свелось,
// git оставляет обычный конфликт человеку. Молча портить бейслайн нельзя:
// любая неоднозначность — это выход 1, а не догадка.
import { readFileSync, writeFileSync } from 'fs';
import { MODES, combineMoved, leafMode } from './merge-json-ratchet-rules.mjs';
import { reportSums, squashedBase } from './merge-json-ratchet-history.mjs';

const [direction, oPath, aPath, bPath, label = '<baseline>'] =
  process.argv.slice(2);

if (!MODES.includes(direction)) {
  console.error(
    `merge-json-ratchet: первым аргументом ожидается ${MODES.join('|')}, получено «${direction}»`,
  );
  process.exit(1);
}

/** Сообщить причину и отдать конфликт человеку. */
function bail(reason) {
  console.error(
    `merge-json-ratchet (${label}): ${reason}.\n` +
      'Свести автоматически не берусь — разреши конфликт руками, ' +
      'а надёжнее пересчитай бейслайн своим гейтом с --update.',
  );
  process.exit(1);
}

/** Прочитать сторону слияния. Пустой/отсутствующий файл = «ключей нет»:
 *  так git отдаёт предка, когда файл добавлен обеими сторонами. */
function load(path, what) {
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return {};
  }
  if (text.trim() === '') return {};
  try {
    return JSON.parse(text);
  } catch {
    bail(`${what} не разбирается как JSON`);
  }
}

const isPlainObject = (v) =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);

/**
 * Порядок ключей результата — как у «нашей» стороны: `--update` пофайловых
 * (file-size, robot-phrases, …) сортирует `localeCompare`, реестр под гейтом
 * порядка (raw-sql-live) — по code point, как `.sort()`; составные
 * (mutation.files, coverage.floors) — в порядке появления, чужие новинки в
 * хвост. `src/a/b_c.ts` и `b-c.ts` эти сортировки ставят по-разному: подошли
 * обе — решает «их» сторона, потом code point (его сверяет гейт).
 */
const ORDERS = [(x, y) => (x < y ? -1 : x > y ? 1 : 0), (x, y) => x.localeCompare(y)];
const sortedBy = (ks, cmp) => ks.length > 1 && same(ks, [...ks].sort(cmp));
function orderKeys(keys, aKeys, bKeys) {
  const fit = ORDERS.filter((cmp) => sortedBy(aKeys, cmp));
  if (fit.length) return [...keys].sort(fit.find((cmp) => sortedBy(bKeys, cmp)) ?? fit[0]);
  const head = aKeys.filter((k) => keys.includes(k));
  return [...head, ...keys.filter((k) => !head.includes(k))];
}

/**
 * Трёхстороннее слияние одного узла.
 * Возвращает undefined, если ключ должен исчезнуть из результата.
 */
function merge3(o, a, b, path) {
  if (a === undefined && b === undefined) return undefined;
  // Ключ пропал на одной из сторон. Был у предка — это осознанное удаление
  // (файл удалён из репозитория), удаление и побеждает. Не был — значит
  // вторая сторона его добавила, добавление сохраняем.
  if (a === undefined) return o === undefined ? b : undefined;
  if (b === undefined) return o === undefined ? a : undefined;

  if (same(a, b)) return a;

  if (isPlainObject(a) && isPlainObject(b)) {
    const oo = isPlainObject(o) ? o : {};
    const [aKeys, bKeys] = [Object.keys(a), Object.keys(b)];
    const keys = [...new Set([...aKeys, ...bKeys])];
    const out = {};
    for (const k of orderKeys(keys, aKeys, bKeys)) {
      const v = merge3(oo[k], a[k], b[k], `${path}.${k}`);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }

  // Лист. Сначала — трёхсторонний вопрос: а обе ли стороны вообще трогали это
  // место? Сторона, совпадающая с предком, его не трогала, и правку второй
  // берём как есть — какой бы она ни была по величине. Главное свойство
  // драйвера: «всегда min» откатывал бы законный рост, принятый в main через
  // `--update`, у ветки, которая этих файлов не видела (INCIDENTS, 2026-09-16).
  if (same(a, o)) return b;
  if (same(b, o)) return a;

  // Обе стороны сдвинули значение относительно предка — вот теперь работает
  // храповик: сумма дельт или лучшее из двух, чтобы сохранить прогресс обеих.
  if (typeof a === 'number' && typeof b === 'number') {
    const mode = leafMode(direction, label, path.slice(2));
    const v = combineMoved(mode, o, a, b);
    if (mode === 'sum' && typeof o === 'number')
      summed.push({ key: path.slice(2), o, a, b, v });
    if (v !== undefined) return v;
  }

  // Не числа (напр. причина-строка в dead-files-baseline) и обе стороны
  // написали своё — или у суммы нет базы-числа: выдумывать нечего.
  return bail(`несводимое расхождение в ${path}`);
}

const ancestor = load(oPath, 'общий предок');
const ours = load(aPath, '«наша» версия');
const theirs = load(bPath, '«их» версия');

if (!isPlainObject(ours) || !isPlainObject(theirs)) {
  bail('бейслайн ожидается объектом верхнего уровня');
}

const summed = []; // листья, сведённые суммой: их и проверяем на задвоение
let merged = merge3(ancestor, ours, theirs, '$') ?? {};
const squash = summed.length ? squashedBase(label, ancestor) : null;
if (squash) {
  summed.length = 0;
  merged = merge3(squash.json, ours, theirs, '$') ?? {};
}
reportSums(label, summed, squash);
writeFileSync(aPath, JSON.stringify(merged, null, 2) + '\n');
