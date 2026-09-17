#!/usr/bin/env node
// Гейт: образ на проде не отстаёт от последнего коммита main (правило №14
// CLAUDE.md, «Отставший деплой виден без рук»).
//
// Класс: инцидент 2026-09-16 — два мержа в main (#494 фикс чтения
// календаря, #495 фикс кольца редиректов входа) сутки не были собраны
// хостингом Amvera. Деплой = push в main, Amvera тянет из GitHub и
// пересобирает сама (CLAUDE.md «Деплой webapp») — отдельного шага
// «задеплоить» нет. CI был зелёным (он проверяет код ДО деплоя), смок прода
// (`prod-smoke.yml`, каждые 15 минут) тоже был зелёным — он проверял, что
// сервер ЖИВ, а не что он СВЕЖИЙ. Узнали руками, по заголовку `last-modified`
// главной страницы.
//
// Логика — чистая функция без сети и файловой системы (`assessDeployLag`):
// сравнивает время сборки образа (`builtAt` из ответа /health, метка
// BUILD_INFO — см. src/utils/build-info.ts) со временем последнего коммита
// main (`--commit-at`, в prod-smoke.yml — `git log -1 --format=%cI` по
// checkout HEAD). Отдельный скрипт, а не shell внутри prod-smoke.yml — по
// тому же правилу, что у остальных гейтов CLAUDE.md («новый гейт приезжает
// со своим тестом»): shell в yaml тестом не накрыть, чистую функцию — можно
// (src/test-support/gates/deploy-lag.spec.ts гоняет этот файл как чёрный
// ящик через runGate).
//
//   node scripts/check-deploy-lag.mjs --built-at=<ISO> --commit-at=<ISO>
//     [--now=<ISO>] [--grace-min=<число>]
//
// --built-at   ISO-время сборки образа (builtAt из /health).
// --commit-at  ISO-время последнего коммита main.
// --now        ISO «текущее» время; по умолчанию реальное сейчас (явный
//              --now нужен тестам ради детерминизма).
// --grace-min  сколько минут после коммита отставание — это ещё идущая
//              сборка, а не поломка; по умолчанию 45. Сборка образа
//              (установка openssl, сборка обоих фронтендов) занимает
//              ~10–15 минут, смок ходит раз в 15 минут — значит настоящее
//              отставание (Amvera не пересобрала вовсе) всплывает в
//              пределах часа, а свежий мерж не красит смок ложно.
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const DEFAULT_GRACE_MINUTES = 45;

/** Пустая/нераспознаваемая строка → null (та же идея, что parseBuildInfo). */
function parseIso(raw) {
  if (!raw) return null;
  const at = new Date(String(raw).trim());
  return Number.isNaN(at.getTime()) ? null : at;
}

function formatDuration(ms) {
  const totalMinutes = Math.round(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours} ч ${minutes} мин` : `${minutes} мин`;
}

/**
 * Сравнивает время сборки образа со временем последнего коммита main.
 * Коды: `no-label` — /health не отдал builtAt; `bad-input` — не разобрались
 * commit-at/now; `fresh` — образ не старее коммита; `building` — старее, но
 * с коммита прошло не больше грейса (сборка ещё может идти); `lagging` —
 * старее, и грейс истёк (реальное отставание, деплой не заехал).
 */
export function assessDeployLag({ builtAt, commitAt, now, graceMinutes }) {
  const builtDate = parseIso(builtAt);
  if (!builtDate) {
    return {
      ok: false,
      code: 'no-label',
      message:
        'прод не отдаёт время сборки (builtAt пуст или не распознан): ' +
        'либо на проде образ старее появления builtAt в /health, либо метка ' +
        'BUILD_INFO не записалась при сборке образа',
    };
  }

  const commitDate = parseIso(commitAt);
  const nowDate = parseIso(now);
  if (!commitDate || !nowDate) {
    return {
      ok: false,
      code: 'bad-input',
      message: `не удалось разобрать время: --commit-at="${commitAt ?? ''}" --now="${now ?? ''}"`,
    };
  }

  if (builtDate.getTime() >= commitDate.getTime()) {
    return {
      ok: true,
      code: 'fresh',
      message: `образ собран ${builtDate.toISOString()} — не старее последнего коммита main ${commitDate.toISOString()}`,
    };
  }

  const grace = graceMinutes;
  const sinceCommitMs = nowDate.getTime() - commitDate.getTime();
  const graceMs = grace * 60_000;

  if (sinceCommitMs <= graceMs) {
    return {
      ok: true,
      code: 'building',
      message: `сборка ещё идёт: с последнего коммита main прошло ${formatDuration(sinceCommitMs)} из допустимых ${grace} мин`,
    };
  }

  return {
    ok: false,
    code: 'lagging',
    message:
      `образ на проде отстал от main: собран ${builtDate.toISOString()}, ` +
      `последний коммит main — ${commitDate.toISOString()}, с коммита прошло ` +
      `${formatDuration(sinceCommitMs)} (грейс ${grace} мин исчерпан) — ` +
      'требуется пересборка проекта в панели Amvera',
  };
}

function argValue(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.find((a) => a.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : undefined;
}

function main() {
  const builtAt = argValue('built-at') ?? '';
  const commitAt = argValue('commit-at') ?? '';
  const now = argValue('now') ?? new Date().toISOString();
  const graceRaw = argValue('grace-min');
  // Битый грейс — ошибка ввода, а не молчаливый дефолт: гейт с NaN-порогом
  // зеленел бы «как обычно», и никто не узнал бы, что порог не применился.
  const graceMinutes =
    graceRaw !== undefined ? Number(graceRaw) : DEFAULT_GRACE_MINUTES;
  if (!Number.isFinite(graceMinutes) || graceMinutes < 0) {
    console.error(`не удалось разобрать грейс: --grace-min="${graceRaw}"`);
    process.exit(1);
  }

  const result = assessDeployLag({ builtAt, commitAt, now, graceMinutes });
  if (result.ok) {
    console.log(result.message);
    process.exit(0);
  }
  console.error(result.message);
  process.exit(1);
}

if (resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) main();
