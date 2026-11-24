// Правила поезда очереди мержа — чистые функции без сети и git. Движок —
// scripts/merge-train.mjs, тест — src/test-support/gates/merge-train.spec.ts.
import { BOT, DEPENDABOT } from './merge-queue-plan.mjs';

export const TRAIN_PREFIX = 'merge-train/';
// Метка виновного в красном поезде: в следующий поезд PR не берут, идёт обычным путём.
export const NO_TRAIN = 'no-train';
export const MAX_CARS = 5;
// Поезд, не доехавший за три круга CI, распускается: застрявший не держит очередь.
export const TRAIN_TTL_MS = 3 * 60 * 60_000;
// Бейслайны, которые пересчитывает штатный `--update` на сведённом дереве:
// драйвер складывает дельты, а размер файла и бандла знает только пересборка.
export const RECOMPUTED = ['scripts/file-size-baseline.json', 'scripts/bundle-size-baseline.json'];
const SUBJECT_MAX = 120;
const MARK = /<!-- merge-train: ([^>]*?) -->/;

/** PR-поезд: открыт ботом очереди из ветки поезда. */
export const isTrain = (p) => p.user?.login === BOT && p.head.ref.startsWith(TRAIN_PREFIX);

const nums = (cars) => cars.map((c) => `#${c.number}`).join(', ');

/**
 * Пассажиры — отставшие зелёные на своей голове, в порядке готовности, до MAX_CARS.
 * Поезда нет, если первый зелёный очереди в него не годится: он идёт обычным
 * путём, иначе поезда раз за разом обгоняли бы его.
 */
export function pickCars(candidates) {
  const green = candidates.filter((p) => p.checks.state === 'green' && !p.flagged);
  const fit = green.filter((p) => !p.train && !p.noTrain && p.author !== DEPENDABOT);
  return fit.length >= 2 && fit[0] === green[0] ? fit.slice(0, MAX_CARS) : [];
}

export const trainTitle = (cars) => `Поезд: ${nums(cars)}`;

/** Тело PR-поезда; состав с головами — в машинной строке, её читает `carsOf`. */
export function trainBody(cars) {
  const list = cars.map((c) => `- #${c.number} ${c.title}`).join('\n');
  const mark = cars.map((c) => `${c.number}@${c.sha}`).join(' ');
  return (
    `Поезд очереди мержа: один круг CI и один мерж вместо ${cars.length}. ` +
    `Собран автоматически, пассажиры закроются после мержа.\n\n${list}\n\n<!-- merge-train: ${mark} -->`
  );
}

/** Состав поезда из тела PR: [{ number, sha }]. */
export function carsOf(body) {
  const m = MARK.exec(body ?? '');
  if (!m) return [];
  return m[1].split(/\s+/).filter(Boolean).map((s) => ({ number: Number(s.split('@')[0]), sha: s.split('@')[1] }));
}

/** Заголовок squash-коммита: номера и заголовки пассажиров; не влезло в 120 знаков — одни номера. */
export function squashTitle(cars, number) {
  const tail = ` (#${number})`;
  const full = `Поезд: ${cars.map((c) => `#${c.number} ${c.title}`).join('; ')}${tail}`;
  return cars.every((c) => c.title) && [...full].length <= SUBJECT_MAX ? full : trainTitle(cars) + tail;
}

/**
 * Что делать с открытым поездом: dissolve — распустить; rebuild — пересобрать
 * (main ушёл, пассажир изменился, красный: `red`); merge — зелёный и свежий;
 * ride — ждать CI. `gone` — пассажиры, которых нет в очереди с той же головой.
 */
export function trainVerdict(train, cars, prs, now, on) {
  const gone = cars.filter((c) => !prs.some((p) => p.number === c.number && p.sha === c.sha));
  if (!on) return { act: 'dissolve', why: 'поезда выключены', gone };
  if (!cars.length) return { act: 'dissolve', why: 'в теле PR нет состава', gone };
  if (now - train.created > TRAIN_TTL_MS) return { act: 'dissolve', why: 'не доехал за три часа', gone };
  if (gone.length) return { act: 'rebuild', why: `изменился пассажир ${nums(gone)}`, gone };
  if (train.behind > 0) return { act: 'rebuild', why: 'main ушёл вперёд', gone };
  if (train.checks.state === 'red') return { act: 'rebuild', why: 'CI красный', gone, red: true };
  return { act: train.checks.state === 'green' ? 'merge' : 'ride', gone };
}

/**
 * Красный поезд. Виновны пассажиры, чьи файлы названы в аннотациях упавших
 * проверок. Не названы (или названы все) — бисекция без метки: вторая половина
 * состава выходит (`split`), пара выходит целиком и идёт по одному.
 */
export function blame(cars, filesOf, paths) {
  const hit = cars.filter((c) => (filesOf[c.number] ?? []).some((f) => paths.includes(f)));
  if (hit.length && hit.length < cars.length) return { guilty: hit, split: [] };
  return { guilty: [], split: cars.length <= 2 ? cars : cars.slice(Math.ceil(cars.length / 2)) };
}

/** Бейслайн после пересчёта — плоский JSON «ключ → целое ≥ 0»; иное в ветку не пишется. */
export function flatCounts(text) {
  try {
    const data = JSON.parse(text);
    if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
    return Object.values(data).every((v) => Number.isInteger(v) && v >= 0);
  } catch {
    return false;
  }
}
