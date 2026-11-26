// Трёхстороннее слияние списка строк для файлов-реестров (docs/BACKLOG.md).
// Встроенный `union` базу не смотрит: строку, удалённую одной стороной, он
// возвращает из другой. Здесь удаление любой стороны — удаление, добавления
// обеих сторон остаются («их», затем «наши»), а одну строку, переписанную
// сторонами по-разному, не сводим: конфликт автору.

/** Правки base → side: [{ start, end, lines }] — base[start, end) заменён на lines. */
export function diffHunks(base, side) {
  let pre = 0;
  while (pre < base.length && pre < side.length && base[pre] === side[pre])
    pre += 1;
  let suf = 0;
  while (
    suf < base.length - pre &&
    suf < side.length - pre &&
    base[base.length - 1 - suf] === side[side.length - 1 - suf]
  ) {
    suf += 1;
  }
  const a = base.slice(pre, base.length - suf);
  const b = side.slice(pre, side.length - suf);
  const w = b.length + 1;
  // lcs[i*w + j] — длина общей подпоследовательности a[i..] и b[j..]
  const lcs = new Uint32Array((a.length + 1) * w);
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      lcs[i * w + j] =
        a[i] === b[j]
          ? lcs[(i + 1) * w + j + 1] + 1
          : Math.max(lcs[(i + 1) * w + j], lcs[i * w + j + 1]);
    }
  }
  const hunks = [];
  let open = null;
  const edit = (at) => (open ??= { start: at, end: at, lines: [] });
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      if (open) hunks.push(open);
      open = null;
      i += 1;
      j += 1;
    } else if (
      j < b.length &&
      (i === a.length || lcs[i * w + j + 1] > lcs[(i + 1) * w + j])
    ) {
      edit(pre + i).lines.push(b[j]);
      j += 1;
    } else {
      edit(pre + i).end = pre + i + 1;
      i += 1;
    }
  }
  if (open) hunks.push(open);
  return hunks;
}

const sameHunk = (x, y) =>
  x.start === y.start &&
  x.end === y.end &&
  x.lines.length === y.lines.length &&
  x.lines.every((l, k) => l === y.lines[k]);
const overlap = (x, y) => x.start < y.end && y.start < x.end;
const rewrites = (h) => h.end > h.start && h.lines.length > 0;

/**
 * Сводит три версии файла (массивы строк). Итог: { lines } или { conflict }
 * с номером строки базы (с 1), которую стороны переписали по-разному.
 */
export function mergeLines(base, ours, theirs) {
  const mine = diffHunks(base, ours);
  const their = diffHunks(base, theirs);
  for (const m of mine) {
    for (const t of their) {
      if (overlap(m, t) && !sameHunk(m, t) && (rewrites(m) || rewrites(t))) {
        return { conflict: Math.max(m.start, t.start) + 1 };
      }
    }
  }
  const gone = new Set();
  const added = new Map(); // позиция в базе → строки, вставляемые перед ней
  const apply = (hunks, skipSame) => {
    for (const h of hunks) {
      for (let k = h.start; k < h.end; k += 1) gone.add(k);
      if (skipSame.some((s) => sameHunk(s, h))) continue;
      const at = added.get(h.start) ?? [];
      // одна и та же запись, дописанная обеими сторонами в одно место, — одна
      const fresh = h.lines.filter((l) => l.trim() === '' || !at.includes(l));
      added.set(h.start, at.concat(fresh));
    }
  };
  apply(their, []);
  apply(mine, their);
  const lines = [];
  for (let k = 0; k <= base.length; k += 1) {
    lines.push(...(added.get(k) ?? []));
    if (k < base.length && !gone.has(k)) lines.push(base[k]);
  }
  return { lines };
}
