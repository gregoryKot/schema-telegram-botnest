#!/usr/bin/env node
// git merge driver для JSON-бейслайнов храповиков (.gitattributes → merge=ratchet-min
// / merge=ratchet-max). Ставится в .git/config скриптом scripts/setup-merge-drivers.mjs.
//
// Зачем. Бейслайны — самый частый источник конфликтов между параллельными
// агентами: scripts/file-size-baseline.json меняли 44 раза из последних 300
// коммитов, coverage-бейслайны — по 20. У скалярных бейслайнов (покрытие,
// jscpd) значимая строка одна на весь файл, поэтому два агента, поднявших
// покрытие, конфликтуют ВСЕГДА.
//
// Хуже того, ручное разрешение такого конфликта почти всегда неверное: агент
// берёт «свою» сторону и молча откатывает чужой прогресс — храповик слабеет,
// и никто этого не замечает (гейт-то зелёный, планка просто ниже).
//
// У храповика есть правильная семантика слияния, и она однозначна:
//   ratchet-min — метрика, где МЕНЬШЕ лучше (строки файлов, робофразы,
//                 мужской род, дубли, слабые ассерты): берём min обеих сторон;
//   ratchet-max — метрика, где БОЛЬШЕ лучше (покрытие, mutation score):
//                 берём max.
// То есть слияние сохраняет весь прогресс обеих сторон и не даёт ослабить
// планку случайно.
//
// Вызов (git подставляет %O %A %B %P):
//   node scripts/merge-json-ratchet.mjs min  %O %A %B %P
// %O — общий предок, %A — «наша» версия И файл, куда пишется результат,
// %B — «их» версия, %P — путь файла в рабочем дереве (только для сообщений).
//
// Выход 0 — слито, git считает конфликт разрешённым; выход 1 — не свелось,
// git оставляет обычный конфликт человеку. Молча портить бейслайн нельзя:
// любая неоднозначность — это выход 1, а не догадка.
import { readFileSync, writeFileSync } from 'fs';

const [direction, oPath, aPath, bPath, label = '<baseline>'] =
  process.argv.slice(2);

if (direction !== 'min' && direction !== 'max') {
  console.error(
    `merge-json-ratchet: первым аргументом ожидается min|max, получено «${direction}»`,
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
const pick = direction === 'max' ? Math.max : Math.min;

/**
 * Порядок ключей результата. Бейслайны пишутся двумя разными способами:
 * пофайловые (file-size, robot-phrases, …) — отсортированы по пути,
 * составные (mutation.files, coverage.floors) — в порядке появления.
 * Смотрим на «нашу» сторону: была отсортирована — держим сортировку,
 * не была — сохраняем её порядок, дописывая чужие новинки в хвост. Иначе
 * драйвер переупорядочил бы файл и следующий `--update` дал бы шум в диффе.
 */
function orderKeys(keys, aKeys) {
  const sortedA = [...aKeys].sort((x, y) => x.localeCompare(y));
  if (aKeys.length > 1 && same(aKeys, sortedA)) {
    return [...keys].sort((x, y) => x.localeCompare(y));
  }
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

  // Собственно храповик: обе стороны сдвинули метрику — берём лучшую.
  if (typeof a === 'number' && typeof b === 'number') return pick(a, b);

  if (isPlainObject(a) && isPlainObject(b)) {
    const oo = isPlainObject(o) ? o : {};
    const aKeys = Object.keys(a);
    const keys = [...new Set([...aKeys, ...Object.keys(b)])];
    const out = {};
    for (const k of orderKeys(keys, aKeys)) {
      const v = merge3(oo[k], a[k], b[k], `${path}.${k}`);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }

  // Не число и не объект (напр. причина-строка в dead-files-baseline):
  // храповой семантики нет, но если сторона совпадает с предком — она просто
  // не трогала это место, и правку второй стороны можно взять без риска.
  if (same(a, o)) return b;
  if (same(b, o)) return a;
  return bail(`несводимое расхождение в ${path}`);
}

const ancestor = load(oPath, 'общий предок');
const ours = load(aPath, '«наша» версия');
const theirs = load(bPath, '«их» версия');

if (!isPlainObject(ours) || !isPlainObject(theirs)) {
  bail('бейслайн ожидается объектом верхнего уровня');
}

const merged = merge3(ancestor, ours, theirs, '$') ?? {};
writeFileSync(aPath, JSON.stringify(merged, null, 2) + '\n');
