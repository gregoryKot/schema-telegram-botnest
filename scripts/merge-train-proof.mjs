// Зелёность пассажира поезда по предку. Авторы сами вливают main и поднимают
// бандл-бейслайн, поэтому зелёной на своей голове отставшая ветка почти не
// бывает: CI новой головы отменяет следующий пуш. Пассажир годится, если
// зелёным был предок, от которого голову отделяют только «прозрачные» коммиты:
// вливание main и правка бейслайнов, которые поезд пересчитывает сам. Это
// эвристика отбора, не гарантия: полный CI идёт на сведённой ветке поезда.
import { DEPENDABOT, checksState, requiredChecks } from './merge-queue-plan.mjs';
import { MAX_CARS, RECOMPUTED } from './merge-train-plan.mjs';

// Глубже — ветка жила без зелёного слишком долго, пусть идёт обычным путём.
export const PROOF_DEPTH = 8;

/**
 * Шаг вдоль первых родителей от головы (`index` 0 — сама голова, её состояние
 * уже известно): proven — предок зелёный; walk — коммит прозрачный, смотрим
 * родителя; stop — содержательный коммит без зелёного.
 * `mergedMain` — второй родитель merge-коммита лежит в main.
 */
export function proofStep(index, commit, state, mergedMain) {
  if (index > 0 && state === 'green') return 'proven';
  const parents = commit.parents?.length ?? 0;
  if (parents === 2) return mergedMain ? 'walk' : 'stop';
  const files = commit.files ?? [];
  const baselines = parents === 1 && files.length > 0 && files.every((f) => RECOMPUTED.includes(f.filename));
  return baselines ? 'walk' : 'stop';
}

/** Sha зелёного предка головы или null. */
export async function greenAncestor({ get, R, required }, head) {
  let sha = head;
  for (let i = 0; i < PROOF_DEPTH; i++) {
    const commit = await get(`${R}/commits/${sha}`);
    const state = i ? checksState(required, (await get(`${R}/commits/${sha}/check-runs?per_page=100`)).check_runs).state : '';
    const second = commit.parents?.length === 2 ? commit.parents[1].sha : null;
    // behind_by 0 — в main есть всё, что есть во втором родителе.
    const mergedMain = !!second && state !== 'green' && (await get(`${R}/compare/${second}...main?per_page=1`)).behind_by === 0;
    const step = proofStep(i, commit, state, mergedMain);
    if (step !== 'walk') return step === 'proven' ? sha : null;
    sha = commit.parents[0].sha;
  }
  return null;
}

/**
 * Помечает `proven` отставших с идущим, отменённым или отсутствующим прогоном,
 * у которых нашёлся зелёный предок; красные и чужие поезду не смотрятся.
 * Отказ API — пассажир просто не доказан: очередь идёт обычным путём.
 */
export async function markProven({ get, R }, candidates) {
  let seats = MAX_CARS - candidates.filter((p) => p.checks.state === 'green').length;
  let required;
  for (const p of candidates) {
    if (seats <= 0) break;
    if (p.checks.state === 'green' || p.flagged || p.noTrain || p.train || p.author === DEPENDABOT) continue;
    try {
      required ??= requiredChecks(await get(`${R}/rules/branches/main`));
      const sha = await greenAncestor({ get, R, required }, p.sha);
      if (!sha) continue;
      p.proven = sha;
      seats--;
      console.log(`#${p.number}: зелёный по предку ${sha.slice(0, 7)} — годится в поезд`);
    } catch (e) {
      console.log(`::warning::#${p.number}: зелёный предок не проверен (${e.message})`);
    }
  }
  return candidates;
}
